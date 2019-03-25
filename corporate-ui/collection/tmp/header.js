export const man = `/* navigation */
h1 {
  color: red; }

.navbar {
  padding: 0; }

.navbar-default {
  font-family: 'Roboto Condensed';
  background-color: #303c49;
  margin-bottom: 0;
  border-bottom: 4px solid var(--danger);
  border-radius: 0;
  z-index: 1000;
  font-size: 1.4rem;
  min-height: auto; }

.navbar-default .navbar-header {
  float: none;
  display: block;
  font-family: 'Roboto Condensed';
  font-weight: bold;
  padding: 2px 0 0px;
  font-size: 1.3rem;
  color: #acb1b6; }

.navbar-default .navbar-header .navbar-brand {
  float: none;
  display: inline-block;
  vertical-align: middle;
  height: auto;
  font-size: 0;
  padding: 0;
  margin: 20px 30px 20px 15px;
  color: #777;
  line-height: 20px; }

.navbar-default .navbar-header .navbar-brand:before {
  display: inline-block;
  content: '';
  background-image: url("https://www.corporate.man.eu/media/nresources/nimages/man_logo.png");
  background-repeat: no-repeat;
  background-size: cover;
  vertical-align: middle;
  width: 103px;
  height: 55px; }

.navbar-default .navbar-header .navbar-nav a,
.navbar-default .navbar-header .navbar-nav span {
  font-family: 'Roboto Condensed';
  font-weight: normal;
  font-size: 12px;
  color: #fff;
  padding: 15px; }

.navbar-default .navbar-header .navbar-symbol {
  display: none; }
`;
export const scania = `:host {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  background-color: #fff;
  font-family: 'Economica';
  font-size: 1.4rem;
  z-index: 1000;
  padding: 0;
  border-bottom: 1px solid #e2e2e2; }

c-navigation {
  background-color: #f5f5f5;
  width: 100%; }

.navbar-default {
  flex: 1;
  padding: 0;
  overflow: hidden;
  background-color: inherit;
  z-index: 1;
  border-bottom: 1px solid #e2e2e2; }
  .navbar-default .navbar-brand {
    padding: 13px; }
    .navbar-default .navbar-brand:before {
      display: block;
      content: '';
      background-image: url("/logotype/elicitation-logotype.png");
      background-image: url("/logotype/elicitation-logotype.svg");
      background-repeat: no-repeat;
      background-size: cover;
      width: 170px;
      height: 28px; }
  .navbar-default .navbar-title {
    font-family: 'Teko';
    font-weight: normal;
    font-size: 1.8rem;
    color: #53565a;
    line-height: 1;
    padding: 0 10px;
    flex: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis; }
  .navbar-default .navbar-nav {
    font-family: 'Economica';
    font-size: 1.2rem;
    text-transform: uppercase;
    color: #747472;
    margin-top: -10px; }

.navbar-symbol {
  padding: 13px;
  border-left: 1px solid #e2e2e2;
  border-bottom: 1px solid #e2e2e2;
  background-color: inherit;
  z-index: 1; }
  .navbar-symbol:before {
    display: block;
    content: '';
    background-image: url("/logotype/scania/scania-symbol.png");
    background-image: url("/logotype/scania/scania-symbol.svg");
    background-repeat: no-repeat;
    background-size: cover;
    width: 40px;
    height: 37px; }

.navbar-toggler {
  border-width: 0 1px 0 0;
  border-color: #e2e2e2;
  padding: 13px; }
  .navbar-toggler-icon {
    margin: 8px; }

@media (min-width: 992px) {
  :host {
    position: sticky;
    top: -84px; }
  c-navigation {
    background-color: transparent;
    border-top: 1px solid #e2e2e2; }
  .navbar-default {
    padding: 19px 11px 10px;
    margin-right: 30px;
    border-bottom: 0; }
    .navbar-default .navbar-brand {
      margin-left: 6px;
      margin-right: 2px; }
    .navbar-default .navbar-title {
      text-align: left;
      border-left: 1px solid #e2e2e2;
      padding-left: 15px; }
  .navbar-symbol {
    position: sticky;
    top: 0;
    margin-top: 8px;
    margin-right: 12px;
    margin-bottom: 2px;
    border-left: 0;
    border-bottom: 0;
    background-color: transparent; }
    .navbar-symbol:before {
      width: 48px;
      height: 46px; } }
`;
