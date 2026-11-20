import '@fontsource/geist/700.css';
import './style.css';
import cities from './cities.json';

const requestedCity = new URLSearchParams(location.search).get('city');
const city = cities.find(option => option.id === requestedCity);
const app = document.querySelector('#app');

if (city) {
  import('./main.js').then(({ startGame }) => startGame(city.id)).catch(error => {
    console.error(error);
    const message = document.createElement('p');
    message.textContent = 'Could not load this city. ';
    const link = document.createElement('a');
    link.href = location.pathname;
    link.textContent = 'Return to city selection';
    message.append(link);
    app.replaceChildren(message);
  });
} else {
  import('./city-menu.js').then(({ showCityMenu }) => showCityMenu(app, cities));
}
