const startingPlasticCount = 0;
const plasticsPerSecond = 752;
const pointsMinZoom = 15;

function startCounter() {
    const counter = document.getElementById("plastic-counter-number");
    if (!counter) {
        return;
    }

    const startTime = Date.now();

    function updateCounter() {
        const seconds = (Date.now() - startTime) / 1000;
        const count = startingPlasticCount + (seconds * plasticsPerSecond);
        counter.textContent = Math.floor(count).toString();
    }

    updateCounter();
    window.setInterval(updateCounter, 1000);
}

function setMapStatus(message, isError = false) {
    const status = document.getElementById("map-status-message");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function createClusterIcon(count) {
    return L.divIcon({
        className: "map-cluster-marker-wrapper",
        html: `<span class="map-cluster-marker">${count}</span>`,
        iconSize: [52, 52],
        iconAnchor: [26, 26]
    });
}

function createPointLayer() {
    return L.geoJSON(null, {
        pointToLayer(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 5,
                fillColor: "#2e7d4f",
                color: "#ffffff",
                weight: 1,
                fillOpacity: 0.85
            });
        },
        onEachFeature(feature, layer) {
            const properties = feature.properties || {};
            const username = properties.username || "Anonymous";
            const date = properties.datetime || properties.created_at || "Date unavailable";
            layer.bindPopup(`${username}<br>${date}`);
        }
    });
}

function createClusterLayer(map) {
    return L.geoJSON(null, {
        pointToLayer(feature, latlng) {
            const properties = feature.properties || {};
            const count = properties.point_count_abbreviated || properties.point_count || "1";

            return L.marker(latlng, {
                icon: createClusterIcon(count)
            });
        },
        onEachFeature(feature, layer) {
            const count = feature.properties?.point_count || 0;
            layer.bindPopup(`Cluster: ${count} points`);
            layer.on("click", () => {
                map.flyTo(layer.getLatLng(), pointsMinZoom);
            });
        }
    });
}

async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

function initializeLeafletMap() {
    if (!document.getElementById("nyc-litter-map") || typeof L === "undefined") {
        return;
    }

    const map = L.map("nyc-litter-map").setView([40.7128, -74.0060], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const clusterLayer = createClusterLayer(map).addTo(map);
    const pointLayer = createPointLayer().addTo(map);

    async function loadMapData() {
        const bounds = map.getBounds();
        const zoom = Math.round(map.getZoom());
        const left = bounds.getWest();
        const bottom = bounds.getSouth();
        const right = bounds.getEast();
        const top = bounds.getNorth();

        const clusterUrl = `https://openlittermap.com/api/clusters?zoom=${zoom}&bbox[]=${left}&bbox[]=${bottom}&bbox[]=${right}&bbox[]=${top}`;

        try {
            const clusters = await loadJson(clusterUrl);
            clusterLayer.clearLayers();
            clusterLayer.addData(clusters);

            pointLayer.clearLayers();
            if (zoom >= pointsMinZoom) {
                const pointsUrl = `https://openlittermap.com/api/points?zoom=${zoom}&bbox[left]=${left}&bbox[bottom]=${bottom}&bbox[right]=${right}&bbox[top]=${top}`;
                const points = await loadJson(pointsUrl);
                pointLayer.addData(points);
                //setMapStatus(`Showing yellow clusters and green points at zoom ${zoom}.`);
            } else {
                //setMapStatus("Showing yellow clusters. Zoom in closer to see green points.");
            }
        } catch (error) {
            clusterLayer.clearLayers();
            pointLayer.clearLayers();
            //setMapStatus("Could not load the map.", true);
        }
    }

    map.on("moveend", loadMapData);
    loadMapData();
}

startCounter();
initializeLeafletMap();
