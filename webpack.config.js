const path = require('path');

module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'sixdb.js',
    path: path.resolve(__dirname, 'indevelop')
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};