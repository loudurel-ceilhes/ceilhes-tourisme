// La liste des contacts reste utilisable sans carte et sans JavaScript.
(() => {
  const button = document.getElementById('services-carte-ouvrir');
  const target = document.getElementById('services-carte');
  const status = document.getElementById('services-carte-statut');
  if (!button || !target || !status || !window.L) return;
  button.hidden = false;
  let map;
  button.addEventListener('click', () => {
    target.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    if (map) { map.invalidateSize(); target.scrollIntoView({ block: 'nearest' }); return; }
    map = L.map(target, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).on('tileerror', () => { status.textContent = 'Le fond de carte est momentanément indisponible. Les adresses et liens d’itinéraire restent accessibles dans les fiches.'; }).addTo(map);
    const points = [];
    document.querySelectorAll('[data-service-lat][data-service-lng]').forEach(card => {
      const lat = Number(card.dataset.serviceLat), lng = Number(card.dataset.serviceLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const label = card.dataset.serviceLabel;
      const popup = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = label; popup.append(title);
      const address = document.createElement('p'); address.textContent = card.querySelector('.service-address')?.textContent || ''; popup.append(address);
      const link = document.createElement('a'); link.href = '#' + card.id; link.textContent = 'Voir les coordonnées et l’itinéraire'; popup.append(link);
      L.marker([lat, lng], { title: label, alt: label }).bindPopup(popup).addTo(map);
      points.push([lat, lng]);
    });
    if (points.length) map.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
    status.textContent = 'Quatre repères affichés. Zoomez pour distinguer la pharmacie et la maison de santé voisines.';
  });
})();
