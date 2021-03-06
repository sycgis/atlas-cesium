define([
  'atlas/material/Color',
  'atlas/material/Style',
  'atlas/model/Line',
  'atlas-cesium/material/Color',
  'atlas-cesium/model/Handle',
  'atlas-cesium/cesium/Source/Core/GeometryInstance',
  'atlas-cesium/cesium/Source/Core/CorridorGeometry',
  'atlas-cesium/cesium/Source/Core/PolylineGeometry',
  'atlas-cesium/cesium/Source/Core/ColorGeometryInstanceAttribute',
  'atlas-cesium/cesium/Source/Core/CornerType',
  'atlas-cesium/cesium/Source/Scene/Primitive',
  'atlas-cesium/cesium/Source/Scene/PerInstanceColorAppearance',
  'atlas-cesium/cesium/Source/Scene/PolylineColorAppearance',
  'atlas/lib/utility/Log',
  'atlas/util/DeveloperError',
  'atlas/util/Timers',
  'atlas/util/WKT',
], function(ColorCore, Style, LineCore, Color, Handle, GeometryInstance, CorridorGeometry,
            PolylineGeometry, ColorGeometryInstanceAttribute, CornerType, Primitive,
            PerInstanceColorAppearance, PolylineColorAppearance, Log, DeveloperError, Timers, WKT) {
  /**
   * @typedef atlas-cesium.model.Line
   * @ignore
   */
  var Line;

  /**
   * @class atlas-cesium.model.Line
   * @extends atlas.model.Line
   */
  Line = LineCore.extend(/** @lends atlas-cesium.model.Line# */{

    // TODO(aramk) Refactor this wth Polygon and Mesh, a lot of building logic is very similar.
    // TODO(aramk) See above - this will add support for elevation.

    /**
     * The Cesium GeometryInstance of the Polygon.
     * @type {GeometryInstance}
     * @private
     */
    _geometry: null,

    /**
     * The Cesium appearance data of the Polygon.
     * @type {PerInstanceColorAppearance}
     * @private
     */
    _appearance: null,

    /**
     * The Cesium Primitive instance of the Polygon, used to render the Polygon in Cesium.
     * @type {Primitive}
     * @private
     */
    _primitive: null,

    /**
     * An array of Cesium cartesian coordinates describing the position of the Polygon
     * on the Cesium globe.
     * @see  {@link http://cesiumjs.org/Cesium/Build/Documentation/Cartesian3.html}
     * @type {Array.<Cartesian3>}
     */
    _cartesians: null,

    /**
     * The minimum terrain elevation underneath the Polygon.
     * @type {Number}
     */
    _minTerrainElevation: 0.0,

    /**
     * The deferred promise for updating primitive styles, which is a asynchronous and should be
     * mutually exclusive.
     * @type {Deferred}
     */
    _updateStyleDf: null,

    // -------------------------------------------
    // CONSTRUCTION
    // -------------------------------------------

    _build: function() {
      var style = this._style;
      var fillMaterial = style.getFillMaterial();
      var isModelDirty = this.isDirty('entity') || this.isDirty('vertices') ||
        this.isDirty('model');
      var isStyleDirty = this.isDirty('style');
      if (isModelDirty) {
        this._removePrimitives();
      }
      this._createGeometry();
      this._createAppearance();
      if (fillMaterial) {
        if ((isModelDirty || !this._primitive) && this._geometry) {
          this._primitive = new Primitive({
            geometryInstances: this._geometry,
            appearance: this._appearance
          });
        } else if (isStyleDirty && this._primitive) {
          this._updateStyleDf && this._updateStyleDf.reject();
          this._updateStyleDf = this._whenPrimitiveReady(this._primitive);
          this._updateStyleDf.promise.then(function() {
            var geometryAtts = this._primitive.getGeometryInstanceAttributes(this._geometry.id);
            geometryAtts.color = ColorGeometryInstanceAttribute.toValue(this._getFillColor());
          }.bind(this));
        }
      }
      this._addPrimitives();
      this._super();
    },

    /**
     * Creates the geometry data as required.
     * @private
     */
    _createGeometry: function() {
      var style = this._style;
      var fillMaterial = style.getFillMaterial();
      var geometryId = this.getId();
      var isModelDirty = this.isDirty('entity') || this.isDirty('vertices') ||
        this.isDirty('model');
      var shouldCreateGeometry = fillMaterial && (isModelDirty || !this._geometry);
      if (!shouldCreateGeometry) {
        return;
      }
      var widthMatches = this._width.toString().match(/(\d+)(px)?/i);
      if (!widthMatches) {
        throw new DeveloperError('Invalid line width: ' + this._width);
      }
      var width = parseFloat(widthMatches[1]);
      var elevation = this._elevation;
      var hasElevation = elevation > 0;
      var isPixels = !!widthMatches[2];
      // Generate new cartesians if the vertices have changed.
      if (isModelDirty || !this._cartesians || !this._minTerrainElevation) {
        Log.debug('updating geometry for entity ' + this.getId());
        // Remove duplicate vertices which cause Cesium to break (4 identical, consecutive vertices
        // cause the renderer to crash).
        var vertices = this._vertices.filter(function(point, i) {
          if (i === 0) {
            return true;
          } else {
            return !this._vertices[i - 1].equals(this._vertices[i]);
          }
        }, this);
        if (vertices.length < 2) {
          return;
        }
        // CorridorGeometry doesn't accept height specified in the vertices, so only perform this
        // for PolylineGeometry.
        if (isPixels && hasElevation) {
          vertices = vertices.map(function(vertex) {
            vertex = vertex.clone();
            vertex.elevation = elevation;
            return vertex;
          });
        }
        this._cartesians = this._renderManager.cartesianArrayFromGeoPointArray(vertices);
        this._minTerrainElevation = this._renderManager.getMinimumTerrainHeight(vertices);
      }
      // Generate geometry data.
      var instanceArgs = {
        id: this.getId().replace('line', '')
      };
      var geometryArgs = {
        positions: this._cartesians,
        width: width
      };
      // CorridorGeometry needs a height setting for elevation.
      if (!isPixels && hasElevation) {
        geometryArgs.height = elevation;
      }
      // PolylineGeometry has line widths in pixels. CorridorGeometry has line widths in metres.
      if (isPixels) {
        geometryArgs.vertexFormat = PolylineColorAppearance.VERTEX_FORMAT;
        geometryArgs.colorsPerVertex = false;
        instanceArgs.geometry = new PolylineGeometry(geometryArgs);
      } else {
        geometryArgs.vertexFormat = PerInstanceColorAppearance.VERTEX_FORMAT;
        geometryArgs.cornerType = CornerType.ROUNDED;
        instanceArgs.geometry = new CorridorGeometry(geometryArgs);
      }
      instanceArgs.attributes = {
        color: ColorGeometryInstanceAttribute.fromColor(this._getFillColor())
      };
      this._geometry = new GeometryInstance(instanceArgs);
    },

    /**
     * Creates the appearance data.
     * @private
     */
    _createAppearance: function() {
      var style = this._style;
      var fillMaterial = style.getFillMaterial();
      var isStyleDirty = this.isDirty('style');
      // If the width is set from pixels to metres, the appearance must be changed to match the new
      // primitive.
      var isModelDirty = this.isDirty('entity') || this.isDirty('vertices') ||
        this.isDirty('model');
      if ((isStyleDirty || isModelDirty || !this._appearance) && fillMaterial) {
        if (this._isPolyline()) {
          this._appearance = new PolylineColorAppearance();
        } else {
          this._appearance = new PerInstanceColorAppearance({
            closed: true,
            translucent: false
          });
        }
      }
    },

    /**
     * @param {Primitive} primitive
     * @return {Q.Deferred} A deferred promise which is resolved when the given primitive is ready
     * for rendering or modifiying.
     */
    _whenPrimitiveReady: function(primitive) {
      return Timers.waitUntil(function() {
        return primitive.ready;
      });
    },

    createHandle: function(vertex, index) {
      // TODO(aramk) Use a factory to use the right handle class.
      return new Handle(this._bindDependencies({target: vertex, index: index, owner: this}));
    },

    _createEntityHandle: function() {
      // Line doesn't need a handle on itself.
      return false;
    },

    // -------------------------------------------
    // MODIFIERS
    // -------------------------------------------

    /**
     * Adds the primitives to the scene.
     * @private
     */
    _addPrimitives: function() {
      var primitives = this._renderManager.getPrimitives();
      this._primitive && primitives.add(this._primitive);
    },

    /**
     * Removes the primitives from the scene.
     * @private
     */
    _removePrimitives: function() {
      // TODO(aramk) Removing the primitives causes a crash with "primitive was destroyed". Hiding
      // them for now.
      if (this._primitive) {
        this._primitive.show = false;
        this._primitive = null;
        this._geometry = null;
      }
    },

    _updateVisibility: function(visible) {
      if (this._primitive) {
        this._primitive.show = visible
      }
    },

    /**
     * Function to permanently remove the Polygon from the scene (vs. hiding it).
     */
    remove: function() {
      this._super();
      this._removePrimitives();
    },

    // -------------------------------------------
    // GETTERS & SETTERS
    // -------------------------------------------

    /**
     * @return {Boolean} Whether the geometry is a {@link PolylineGeometry} as opposed to a
     * {@link CorridorGeometry} or not existing.
     */
    _isPolyline: function() {
      return this._geometry && this._geometry.geometry instanceof PolylineGeometry;
    },

    _toCesiumMaterial: function(material) {
      // Temporary solution until we have factories.
      if (material instanceof ColorCore) {
        material.toCesiumColor = Color.prototype.toCesiumColor.bind(material);
        return Color.prototype.toCesiumMaterial.apply(material);
      } else {
        throw new Error('Cannot create Cesium Material.');
      }
    },

    _getFillColor: function() {
      var style = this._style;
      var material = style.getFillMaterial();
      if (material instanceof ColorCore) {
        return Color.prototype.toCesiumColor.bind(material)();
      } else {
        // Only color is supported for polyline borders at the moment. Reject all other materials.
        throw new Error('Only Color material is supported for Polygon border.');
      }
    }

  });

  return Line;
});
