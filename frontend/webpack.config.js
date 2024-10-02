const path = require('path');

module.exports = {
  mode: 'development',  // 'production' から 'development' に変更
  entry: './src/renderer/index.js',
  target: 'electron-renderer',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'build'),
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  devtool: 'source-map'  // ソースマップを追加
};
