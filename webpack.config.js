const HtmlWebpackPlugin = require('html-webpack-plugin'),
      path = require('path'),
      webpack = require('webpack')

module.exports = {
  context: path.join(__dirname, 'src'),
  entry: {
    'app': './app.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js'
  },
  module: {
    rules: [{
        test: /\.css$/,
        use: [ 'style-loader', 'css-loader' ]
      },
      {
          test: /\.(eot|svg|ttf|woff|woff2)$/,
          loader: 'file-loader?name=public/fonts/[name].[ext]'
      },
      { 
          test: /\.(woff|png|jpg|gif)$/, 
          loader: 'url-loader?limit=10000'
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets: [
            'es2015',
            'react'
          ],
          plugins: [
            "transform-object-rest-spread"
          ]
        },
        include: [
          path.resolve(__dirname, 'src')
        ]
      }, 
      {
        test: /\.json$/,
        loader: "json-loader"
      }]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }),
    new HtmlWebpackPlugin({ 
      template: path.join(__dirname, 'src', 'index.ejs'),
      DEVURL: process.env.DEVURL,
      SECRETURL: process.env.SECRETURL
    })
  ],
  resolve: {
    modules: [
      path.join(process.cwd(), 'app'),
      'node_modules'
    ],
    extensions: ['.js', '.json']
  },
  devtool: false,
  devServer: {
    proxy: {
      '/api': {
        target: 'https://other-server.example.com',
        secure: false
      }
    }
  }
};