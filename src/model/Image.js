define([
  'atlas/material/Color',
  'atlas/material/Style',
  'atlas-cesium/model/Handle',
  'atlas-cesium/cesium/Source/Core/GeometryInstance',
  'atlas-cesium/cesium/Source/Core/PolygonGeometry',
  'atlas-cesium/cesium/Source/Scene/Primitive',
  'atlas-cesium/cesium/Source/Core/Cartographic',
//  'atlas-cesium/cesium/Source/Scene/EllipsoidSurfaceAppearance',
  'atlas-cesium/cesium/Source/Scene/Material',
  'atlas-cesium/cesium/Source/Scene/MaterialAppearance',
  'atlas-cesium/cesium/Source/Core/Color',
  // Base class
  'atlas/model/Image',
  'atlas/lib/utility/Log'
], function(Color, Style, Handle, GeometryInstance, PolygonGeometry, Primitive, Cartographic,
            Material, MaterialAppearance, CesiumColor, ImageCore, Log) {

  var Image = ImageCore.extend(/** @lends atlas-cesium.model.Polygon# */ {

    /**
     * The Cesium GeometryInstance of the Image.
     * @type {GeometryInstance}
     * @private
     */
    _geometry: null,

    /**
     * The Cesium appearance data of the Image.
     * @type {EllipsoidSurfaceAppearance|MaterialAppearance}
     * @private
     */
    _appearance: null,

    /**
     * The Cesium Primitive instance of the Image, used to render the Image in Cesium.
     * @type {Primitive}
     * @private
     */
    _primitive: null,

    /**
     * An array of Cesium cartesian coordinates describing the position of the Polygon
     * on the Cesium globe.
     * @see  {@link http://cesiumjs.org/Cesium/Build/Documentation/Cartesian3.html}
     * @type {Cartesian3}
     */
    _cartesians: null,

    /**
     * The minimum terrain elevation underneath the Polygon.
     * @type {Number}
     */
    _minTerrainElevation: 0.0,

    // -------------------------------------------
    // GETTERS AND SETTERS
    // -------------------------------------------

    /**
     * Returns whether this Polygon is visible. Overrides the default Atlas implementation
     * to use the visibility flag that is set of the Cesium Primitive of the Polygon.
     * @returns {Boolean} - Whether the Polygon is visible.
     */
    isVisible: function() {
      return this._primitive && this._primitive.show === true;
    },

    // -------------------------------------------
    // MODIFIERS
    // -------------------------------------------

    /**
     * Generates the data structures required to render a Polygon
     * in Cesium.
     */
    _createPrimitive: function() {
      Log.debug('creating primitive for entity', this.getId());
      // TODO(aramk) _geometry isn't actually set.
      this._geometry = this._updateGeometry();
      this._appearance = this._updateAppearance();
      return new Primitive({
        geometryInstances: this.getGeometry(),
        appearance: this.getAppearance()
      });
    },

    /**
     * Updates the geometry data as required.
     * @returns {GeometryInstance}
     * @private
     */
    _updateGeometry: function() {
      // Generate new cartesians if the vertices have changed.
      if (this.isDirty('entity') || this.isDirty('vertices') || this.isDirty('model')) {
        Log.debug('updating geometry for entity ' + this.getId());
        this._cartesians = this._renderManager.cartesianArrayFromVertexArray(this._vertices);
        this._minTerrainElevation = this._renderManager.getMinimumTerrainHeight(this._vertices);
      }

      // TODO(aramk) The zIndex is currently absolute, not relative to the parent or using bins.
      var elevation = this._minTerrainElevation + this._elevation +
        this._zIndex * this._zIndexOffset;

      var holes = [];
      if (this._holes) {
        for (var i in this._holes) {
          var hole = this._holes[i];
          var cartesians = this._renderManager.cartesianArrayFromVertexArray(hole.coordinates);
          holes.push({positions : cartesians});
        }
      }
      // Generate geometry data.
      var polygonHierarchy = {
        positions : this._cartesians,
        holes : holes
      };
      return new GeometryInstance({
        id: this.getId().replace('polygon', ''),
        geometry: new PolygonGeometry({
          polygonHierarchy: polygonHierarchy,
          height: elevation,
          extrudedHeight: elevation + (this._showAsExtrusion ? this._height : 0)
        })
      });
    },

    /**
     * Updates the appearance data.
     * @private
     */
    _updateAppearance: function() {
      if (this.isDirty('entity') || this.isDirty('style')) {
        Log.debug('updating appearance for entity ' + this.getId());
        var material = new Material({
          fabric : {
            type : 'DiffuseMap',
            uniforms : {
              image : this._image
            }
          }
        });
        if (!this._appearance) {
          // TODO(bpstudds): Fix rendering so that 'closed' can be enabled.
          //                 This may require sorting of vertices before rendering.
          this._appearance = new MaterialAppearance({
            material : material,
            faceForward : true
          });
        }
        this._appearance.material.uniforms.color =
          Image._convertStyleToCesiumColors(this._style).fill;
      }
      return this._appearance;
    },

    /**
     * Builds the geometry and appearance data required to render the Polygon in
     * Cesium.
     */
    _build: function() {
      if (!this._primitive || this.isDirty('vertices') || this.isDirty('model')) {
        if (this._primitive) {
          this._renderManager.getPrimitives().remove(this._primitive);
        }
        this._primitive = this._createPrimitive();
        this._renderManager.getPrimitives().add(this._primitive);
      } else if (this.isDirty('style')) {
        this._updateAppearance();
      }
    },

    _updateVisibility: function(visible) {
      if (this._primitive) this._primitive.show = visible;
    },

    /**
     * Function to permanently remove the Polygon from the scene (vs. hiding it).
     */
    remove: function() {
      this._super();
      this._primitive && this._renderManager.getPrimitives().remove(this._primitive);
    }

  });

  // -------------------------------------------
  // STATICS
  // -------------------------------------------

  // TODO(aramk) Use newer code

  /**
   * Takes an atlas Style object and converts it to Cesium Color objects.
   * @param {atlas.model.Style} style
   * @private
   */
  Image._convertStyleToCesiumColors = function(style) {
    return {
      fill: Image._convertAtlasToCesiumColor(style.getFillMaterial()),
      border: Image._convertAtlasToCesiumColor(style.getBorderMaterial())
    }
  };

  /**
   * Converts an Atlas Color object to a Cesium Color object.
   * @param {atlas.material.Color} color - The Color to convert.
   * @returns {Color} The converted Cesium Color object.
   * @private
   */
  Image._convertAtlasToCesiumColor = function(color) {
    // TODO(bpstudds) Determine how to get Cesium working with alpha enabled.
    return new CesiumColor(color.red, color.green, color.blue, /* override alpha temporarily*/ 1);
  };

  return Image;
});
