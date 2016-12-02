describe('Penpal', function() {
  beforeAll(function() {
    Penpal.Promise = RSVP.Promise;
    Penpal.debug = true;
  });

  it('should complete a handshake', function (done) {
    const penpal = Penpal.connectToChild({
      url: 'http://localhost:9000/child.html'
    });

    penpal.promise.then(() => {
      penpal.destroy();
      done();
    });
  });

  it('should call a function on the child', function (done) {
    const penpal = Penpal.connectToChild({
      url: 'http://localhost:9000/child.html'
    });

    penpal.promise.then(function (child) {
      child.multiply(2, 5).then(function (value) {
        expect(value).toEqual(10);
        penpal.destroy();
        done();
      });
    });
  });

  it('should call an asynchronous function on the child', function (done) {
    const penpal = Penpal.connectToChild({
      url: 'http://localhost:9000/child.html'
    });

    penpal.promise.then(function (child) {
      child.multiplyAsync(2, 5).then(function (value) {
        expect(value).toEqual(10);
        penpal.destroy();
        done();
      });
    });
  });

  it('should call a function on the parent', function (done) {
    const penpal = Penpal.connectToChild({
      url: 'http://localhost:9000/child.html',
      methods: {
        add: function(num1, num2) {
          return num1 + num2;
        }
      }
    });

    penpal.promise.then(function (child) {
      child.addUsingParent().then(function() {
        child.getParentReturnValue().then(function (value) {
          expect(value).toEqual(9);
          penpal.destroy();
          done();
        });
      });
    });
  });

  it('should handle rejected promises', function (done) {
    const penpal = Penpal.connectToChild({
      url: 'http://localhost:9000/child.html',
    });

    penpal.promise.then(function (child) {
      child.getRejectedPromise().then(
        function() {},
        function(error) {
          expect(error).toBe('test error message');
          penpal.destroy();
          done();
        }
      )
    })
  });
});
