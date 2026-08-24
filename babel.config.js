module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // gluestack-ui pulls in react-stately, which ships static class blocks.
    // Hermes/Metro needs this transform or bundling fails with
    // "Static class blocks are not enabled".
    plugins: ['@babel/plugin-transform-class-static-block'],
  };
};
