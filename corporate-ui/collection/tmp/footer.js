export const man = `:host {
  background-color: #f4f4f4; }

:host .wordmark {
  background-image: url(https://www.corporate.man.eu/media/nresources/nimages/man_logo.png);
  width: 103px;
  height: 55px; }
`;
export const scania = `:host {
  display: block;
  color: var(--footer-color);
  color: #97999b;
  background-color: var(--footer-background);
  background-color: #000; }

a,
button {
  text-transform: uppercase; }

p {
  font-size: 1rem;
  border-top: solid 1px #e7e7e7;
  padding-top: 10px;
  margin-bottom: 0; }

.navbar {
  flex-direction: column;
  padding: 0; }

.navbar-brand {
  display: block;
  margin: 10px; }
  .navbar-brand:before {
    display: inline-block;
    content: '';
    width: 113px;
    height: 18px;
    background-size: 100%;
    background-repeat: no-repeat;
    background-image: var(--footer-background-url);
    background-image: url(/logotype/elicitation-logotype-white.png);
    background-image: url(/logotype/elicitation-logotype-white.svg); }

.navbar-collapse {
  order: -1; }

.navbar-content {
  background-color: #fff;
  padding: 10px;
  width: 100%;
  text-align: center;
  position: relative; }

.nav-link:hover, .nav-link:focus {
  text-decoration: underline; }

.btn-group.show .dropdown-menu {
  display: block;
  background-color: #000;
  left: 50%;
  transform: translate(-50%);
  margin-bottom: 0;
  border: 0; }
  .btn-group.show .dropdown-menu .dropdown-item, .btn-group.show .dropdown-menu .dropdown-item:focus, .btn-group.show .dropdown-menu .dropdown-item:hover {
    background-color: transparent;
    color: #fff; }

.btn-group.show .dropdown-toggle {
  background-color: #000;
  color: #fff; }

.btn-group .dropdown-toggle {
  color: #000; }

@media (min-width: 992px) {
  :host {
    padding: 46px 30px 35px; }
  a {
    color: #fff; }
  p {
    border-top: 0;
    margin-top: 0; }
  .navbar {
    flex-direction: row;
    flex-wrap: wrap; }
  .navbar-brand {
    margin: 0; }
    .navbar-brand:before {
      width: 178px;
      height: 29px; }
  .navbar-content {
    background-color: transparent;
    text-align: left;
    padding-left: 0; }
  .navbar-nav {
    font-family: 'Economica';
    font-size: 1.4rem;
    font-weight: bold;
    text-transform: uppercase;
    margin: 0; }
  .nav-item + .nav-item {
    margin-left: 10px; }
  .nav-item .nav-link {
    padding: 0; } }
`;
