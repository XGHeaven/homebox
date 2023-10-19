const path = require('path');

const mode = process.env.NODE_ENV || "development";
const prod = mode === "production";

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: {
    main: './src/index.tsx',
  },
  output: {
    filename: "[name].js",
    chunkFilename: "[name].[id].js",
    path: path.resolve(__dirname, '../build/static'),
    publicPath: prod ? '/static/' : undefined
  },
  builtins: {
    html: [{ template: './src/index.html' }],
    emotion: true,
    react: {
      importSource: '@emotion/react',
    },
  },
  devtool: !prod ? undefined : false
};
