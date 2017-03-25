import React, { Component } from 'react';


export default  ({user}) => {


  return (
      <nav className="navbar navbar-default">
        <div className="navbar-global theme-default">
          <div className="container-fluid">
            <div className="navbar-header">
                <button type="button" className="navbar-toggle collapsed" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1">
                    <span className="sr-only">Toggle navigation</span>
                    <i className="glyph glyph-hamburger"></i>
                </button>

                <a href="#/" className="navbar-brand no-outline">
                    <img src="https://assets.onestore.ms/cdnfiles/onestorerolling-1511-11008/shell/v3/images/logo/microsoft.png" alt="Microsoft" height="23"/>
                </a>
            </div>
            <div className="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
                <ul className="nav navbar-nav">
                    <li className="dropdown">
                        <a href="colors.html" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Movie Catalogue <i className="glyph glyph-chevron-down-2"></i></a>
                        <ul className="dropdown-menu" role="menu">
                            <li><a href="colors.html">Offers</a></li>
                            <li className="divider"></li>
                            <li><a href="colors.html#bootstrap-colors">Action</a></li>
                            <li><a href="colors.html#mdl-colors">Childrens</a></li>
                            <li><a href="colors.html#mdl-alt-colors">Animation</a></li>
                            <li><a href="colors.html#mdl-alt-colors">Thriller</a></li>
                            <li><a href="colors.html#mdl-alt-colors">Si-Fi</a></li>
                        </ul>
                    </li>

                    <li className="dropdown">
                        <a href="typography.html" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Live TV <i className="glyph glyph-chevron-down-2"></i></a>
                        <ul className="dropdown-menu" role="menu">
                            <li><a href="typography.html">News</a></li>
                            <li><a href="typography.html#fonts">BBC</a></li>
                            <li><a href="typography.html#sizes">SKY</a></li>
                            <li><a href="typography.html#headings">Freeview</a></li>
                        </ul>
                    </li>

                    { !user ?
                        <li className="dropdown">
                            <a href="http://localhost:5000/auth/aad" role="button" aria-expanded="false">Login</a>
                            
                        </li>
                    :
                        <li className="dropdown">
                            <a href="layout.html" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">{user.name} <i className="glyph glyph-chevron-down-2"></i></a>
                            <ul className="dropdown-menu" role="menu">
                                <li><a href="#/amsadmin">Catalog Admin</a></li>
                                <li><a href="layout.html#page-header">Account</a></li>
                                <li><a href="layout.html#grid">Logout</a></li>
                            </ul>
                        </li>
                    }
                </ul>
                <form className="navbar-form navbar-right" role="search">
                    <div className="form-group">
                        <input type="search" className="form-control" placeholder="Search"/>
                    </div>
                    <button type="submit" className="btn btn-default"></button>
                </form>
            </div>
          </div>
        </div>
      </nav>
  )
}