export const scania = `:host {
  background-color: #fff; }

ul {
  margin: 0; }

.navbar {
  padding: 0; }

.navbar-nav {
  font-family: 'Economica';
  font-size: 1.4rem;
  font-weight: bold;
  text-transform: uppercase; }

.navbar-collapse + .navbar-collapse {
  border-top: 1px solid #e2e2e2; }

.nav-item + .nav-item {
  border-top: 1px solid #e2e2e2; }

.nav-item .nav-link {
  padding: 10px 25px;
  color: #909090; }
  .nav-item .nav-link:hover {
    color: #041e42; }

@media (min-width: 992px) {
  .navbar-collapse + .navbar-collapse {
    border-top: 0; }
  .navbar-nav .nav-item {
    border-top: 0; }
    .navbar-nav .nav-item .nav-link {
      padding: 20px 0; }
      .navbar-nav .nav-item .nav-link:before, .navbar-nav .nav-item .nav-link:after {
        content: "";
        padding: 0 15px; }
    .navbar-nav .nav-item + .nav-item .nav-link:before {
      border-left: 1px solid #e2e2e2; } }
`;
