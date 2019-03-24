export const man = `:host {
  background-color: #f4f4f4; }

:host .wordmark {
  background-image: url(https://www.corporate.man.eu/media/nresources/nimages/man_logo.png);
  width: 103px;
  height: 55px; }
`;
export const scania = `::slotted(a), .navbar .navbar-nav .nav-item.nav-link {
  text-decoration: none;
  color: #fff;
  padding: 5px; }

::slotted(a:hover), .navbar .navbar-nav .nav-item.nav-link:hover, .navbar .navbar-nav .nav-item.nav-link:focus {
  text-decoration: underline; }

:host {
  background-color: #fff; }

p {
  width: 100%;
  font-size: 1rem;
  text-align: center;
  border-top: solid 1px #e7e7e7;
  padding: 10px;
  margin-top: 0;
  margin-bottom: 0; }

.navbar {
  flex-direction: column;
  padding: 0; }
  .navbar .navbar-nav {
    text-transform: uppercase;
    margin-top: 0; }

.navbar-brand {
  display: block;
  width: 100%;
  margin: 0;
  padding: 10px;
  background-color: #000;
  text-align: center; }
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
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #000;
  padding: 10px;
  white-space: nowrap;
  font-size: 1rem;
  text-align: center; }
  .navbar-collapse.show + .navbar-toggler {
    background-color: #000;
    color: #fff; }

.navbar-toggler {
  border-radius: 0;
  /* This should probably be added to btn rules */ }
  .navbar-toggler, .navbar-toggler:hover {
    color: #000; }

.navigation {
  position: relative; }

@media (min-width: 992px) {
  ::slotted(a), .navbar .navbar-nav .nav-item.nav-link {
    text-decoration: none;
    padding: 0; }
  ::slotted(a:hover), .navbar .navbar-nav .nav-item.nav-link:hover {
    text-decoration: underline; }
  ::slotted(a:not(:first-child)), .navbar .navbar-nav .nav-item + .nav-item {
    margin-left: 15px; }
  :host {
    background-color: #000;
    color: #97999b;
    padding: 46px 30px 35px; }
  p {
    text-align: left;
    padding: 0;
    border-top: 0; }
  .navbar {
    flex-direction: row;
    flex-wrap: wrap; }
  .navbar-nav {
    font-family: 'Economica';
    font-size: 1.4rem;
    font-weight: bold;
    text-transform: uppercase; }
  .navbar-brand {
    padding: 0;
    width: auto; }
    .navbar-brand:before {
      width: 178px;
      height: 29px; }
  .navbar-collapse {
    position: static;
    transform: none;
    padding: 0; }
  .navigation {
    order: -1;
    flex: 1; } }
`;
