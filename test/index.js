describe('penpal', function() {
  beforeAll(function() {
    PenPal.Promise = RSVP.Promise;
  });

  it('should complete a handshake', function (done) {
    PenPal.connectToChild({
      url: 'http://localhost:9000/child.html'
    }).then(function (child) {
      child.destroy();
      done();
    });
  });

  it('should call a function on the child', function (done) {
    PenPal.connectToChild({
      url: 'http://localhost:9000/child.html'
    }).then(function (child) {
      child.multiply(2, 5).then(function (value) {
        expect(value).toEqual(10);
        child.destroy();
        done();
      }).catch(function(err) { done(err); });
    });
  });

  it('should call an asynchronous function on the child', function (done) {
    PenPal.connectToChild({
      url: 'http://localhost:9000/child.html'
    }).then(function (child) {
      child.multiplyAsync(2, 5).then(function (value) {
        expect(value).toEqual(10);
        child.destroy();
        done();
      }).catch(function(err) { done(err); });
    });
  });

  it('should call a function on the parent', function (done) {
    PenPal.connectToChild({
      url: 'http://localhost:9000/child.html',
      methods: {
        add: function(num1, num2) {
          return num1 + num2;
        }
      }
    }).then(function (child) {
      child.addUsingParent().then(function() {
        child.getParentReturnValue().then(function (value) {
          expect(value).toEqual(9);
          child.destroy();
          done();
        }).catch(function(err) { done(err); });
      }).catch(function(err) { done(err); });
    });
  });
});
