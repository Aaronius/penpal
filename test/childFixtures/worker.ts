importScripts('/base/dist/penpal.js');

Penpal.connectToParentFromIframe({
  methods: {
    multiply: function (num1, num2) {
      console.log('multiply received');
      return num1 * num2;
    },
  },
  debug: true,
});
