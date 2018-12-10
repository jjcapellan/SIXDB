const path = require('path');
const webpack = require('webpack');

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
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: '@author       Juan Jose Capellan <soycape@hotmail.com>\n' +
      '@copyright    2018 Juan Jose Capellan\n' +
      '@license      {@link https://github.com/jjcapellan/SIXDB/blob/master/LICENSE | MIT license}',
      entryOnly: true
    })
  ]
};