import { appTitle } from './appTitle';

document.title = appTitle;
const heading = document.getElementById('title');
if (heading) {
  heading.textContent = appTitle;
}
