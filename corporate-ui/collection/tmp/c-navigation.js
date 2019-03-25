export const scania = `:host {
  background-color: #f5f5f5; }

::slotted(a), .navbar .navbar-nav .nav-item.nav-link {
  padding: 10px 25px;
  color: #909090;
  text-decoration: none; }

::slotted(a:hover), .navbar .navbar-nav .nav-item.nav-link:hover {
  color: #041e42; }

::slotted(a:not(:first-child)), .navbar .navbar-nav .nav-item + .nav-item {
  border-top: 1px solid #e2e2e2; }

ul {
  margin: 0; }

.navbar {
  font-family: 'Economica';
  font-size: 1.4rem;
  font-weight: bold;
  text-transform: uppercase;
  padding: 0; }

.navbar-collapse {
  transition: max-height 0.25s ease-in;
  max-height: 0;
  overflow: hidden; }
  .navbar-collapse:not(.show) {
    display: block;
    max-height: 100px; }
  .navbar-collapse + .navbar-collapse {
    border-top: 1px solid #e2e2e2; }

@media (min-width: 992px) {
  ::slotted(a), .navbar .navbar-nav .nav-item.nav-link {
    padding: 20px 0; }
    ::slotted(a):before, .navbar .navbar-nav .nav-item.nav-link:before, ::slotted(a):after, .navbar .navbar-nav .nav-item.nav-link:after {
      content: "";
      padding: 0 15px; }
  ::slotted(a:not(:first-child)), .navbar .navbar-nav .nav-item + .nav-item {
    border-top: none; }
  ::slotted(a:not(:first-child)):before, .navbar .navbar-nav .nav-item.nav-link + .nav-link:before {
    border-left: 1px solid #e2e2e2; }
  :host {
    background-color: #fff; }
  .navbar .navbar-nav .nav-item {
    border-top: 0; }
  .navbar-collapse {
    max-height: none; }
    .navbar-collapse + .navbar-collapse {
      border-top: 0; } }
`;
