importScripts('/base/dist/penpal.js');

Penpal.connectToParent({
  methods: {
    multiply: function (num1, num2) {
      console.log('multiply received');
      return num1 * num2;
    },
  },
  debug: true,
});
