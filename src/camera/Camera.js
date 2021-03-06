define([
  // Base class.
  'atlas/camera/Camera',
  'atlas/model/Vertex',
  'atlas/lib/utility/Log',
  'atlas/lib/utility/Setter',
  'atlas/util/AtlasMath',
  'atlas/util/DeveloperError',
  'atlas-cesium/cesium/Source/Core/Cartographic',
  'atlas-cesium/model/Rectangle'
], function(CameraCore, Vertex, Log, Setter, AtlasMath, DeveloperError, Cartographic, Rectangle) {
  /**
   * @class atlas-cesium.camera.Camera
   * @extends atlas.camera.Camera
   */
  return CameraCore.extend(/** @lends atlas-cesium.camera.Camera# */ {

    _init: function(args) {
      if (!args.renderManager) {
        throw new DeveloperError('Can not create Atlas-Cesium Camera without render manager.');
      }
      this._super(args);
      this._renderManager = args.renderManager;
    },

    // -------------------------------------------
    // GETTERS AND SETTERS
    // -------------------------------------------

    getPosition: function() {
      // TODO(aramk) This is accessing the global camera, not the current camera.
      var cesiumCamera = this._renderManager.getCesiumCamera();
      var cartesian = cesiumCamera.position;
      return this._renderManager.geoPointFromCartesian(cartesian);
    },

    getOrientation: function() {
      // TODO(aramk) This is accessing the global camera, not the current camera.
      return this._getOrientationFromCesiumCamera(this._renderManager.getCesiumCamera());
    },

    _getOrientationFromCesiumCamera: function(camera) {
      // TODO(aramk) Rotation not handled.
      var bearing = AtlasMath.toDegrees(camera.heading);
      var roll = AtlasMath.toDegrees(camera.roll);
      var tilt = AtlasMath.toDegrees(camera.pitch);
      return {bearing: bearing, roll: roll, tilt: tilt};
    },

    setDirection: function(direction) {
      var cesiumCamera = this._renderManager.getCesiumCamera();
      cesiumCamera.direction = direction;
      this.setOrientation(this._getOrientationFromCesiumCamera(cesiumCamera));
    },

    getDirection: function() {
      var camera = this._renderManager.getCesiumCamera();
      var direction = camera.direction;
      return new Vertex(direction);
    },

    getUp: function() {
      var camera = this._renderManager.getCesiumCamera();
      var up = camera.up;
      return new Vertex(up);
    },

    _getPositionAsCartesian: function(position) {
      position = position.toRadians();
      var cartographic =
          new Cartographic(position.longitude, position.latitude, position.elevation);
      return this._renderManager.getEllipsoid().cartographicToCartesian(cartographic);
    },

    // -------------------------------------------
    // TARGETED MOVEMENT
    // -------------------------------------------

    /**
     * Changes the direction of the camera to point at the given point.
     * @param {atlas.model.GeoPoint} point
     */
    pointAt: function(point) {
      point = point.toRadians();
      var cesiumCamera = this._renderManager.getCesiumCamera();
      var ellipsoid = this._renderManager.getEllipsoid();
      var targetCartographic = new Cartographic(point.longitude, point.latitude, point.elevation);
      var target = ellipsoid.cartographicToCartesian(targetCartographic);
      cesiumCamera.lookAt(target, cesiumCamera.position);
    },

    // -------------------------------------------
    // BEHAVIOUR
    // -------------------------------------------

    _animate: function(args) {
      args = Setter.mixin({}, args);
      // TODO(aramk) Rename position and rectangle to just "destination".
      var position = args.position;
      var rectangle = args.rectangle;
      var orientation = args.orientation;
      var scene = this._renderManager.getScene();
      var destination;
      var flightArgs = {
        // Cesium uses duration in seconds.
        duration: args.duration / 1000 || 0,
        path: args.path
      };
      if (rectangle) {
        // TODO(aramk) Currently passes atlas model into atlas-cesium constructor. If we had a
        // factory we would have the right type and not need this.
        rectangle = new Rectangle(rectangle);
        destination = rectangle.toCesiumRectangle();
      } else if (position) {
        destination = this._renderManager.cartesianFromGeoPoint(position);
      } else {
        throw new Error('Either position or rectangle must be provided.');
      }
      flightArgs.destination = destination;
      if (position) {
        if (!args.direction && orientation) {
          // Use the given orientation in place of the direction.
          var cesiumCamera = this._renderManager.getCesiumCamera();
          cesiumCamera.setView({
            position: this._getPositionAsCartesian(position),
            heading: AtlasMath.toRadians(orientation.bearing),
            pitch: AtlasMath.toRadians(orientation.tilt),
            roll: AtlasMath.toRadians(orientation.rotation)
          });
          flightArgs.direction = cesiumCamera.direction;
          flightArgs.up = cesiumCamera.up;
        } else {
          flightArgs.direction = args.direction;
          flightArgs.up = args.up;
        }
        // TODO(aramk) Add support for atlas.camera.PathType back in.
        scene.camera.flyTo(flightArgs);
        Log.debug('Animating camera to position', position, orientation);
      } else {
        scene.camera.flyTo(flightArgs);
        Log.debug('Animating camera to rectangle', rectangle);
      }
    }
  });
});
