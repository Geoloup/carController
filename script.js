// Car Camera System Application

// Global variables
var peer;
var conn;
var currentMode = 'car'; // 'car', 'camera', or 'client'
var isConnected = false;
var carId = '';
var cameraRole = 'front'; // 'front' or 'back'

// Camera streams
let cameraStream;

// Available devices
let videoDevices = [];

// Ping/Latency measurement
let lastPingTime = 0;
let currentLatency = 0;
let pingInterval;

// Connection tracking
let connectedCameras = {};
let connectedClients = {};

// DOM Elements - Mode Selection
const carModeBtn = document.getElementById('car-mode-btn');
const cameraModeBtn = document.getElementById('camera-mode-btn');
const clientModeBtn = document.getElementById('client-mode-btn');
const carInterface = document.getElementById('car-interface');
const cameraInterface = document.getElementById('camera-interface');
const clientInterface = document.getElementById('client-interface');

// DOM Elements - Car Mode (Server)
const carIdElement = document.getElementById('car-id');
const copyCarIdButton = document.getElementById('copy-car-id');
const generateNewIdButton = document.getElementById('generate-new-id');
const carConnectionStatus = document.getElementById('car-connection-status');
const carConnectionLatency = document.getElementById('car-connection-latency');
const connectedCamerasList = document.getElementById('connected-cameras-list');
const connectedClientsList = document.getElementById('connected-clients-list');

// DOM Elements - Camera Mode
const carIdInputCamera = document.getElementById('car-id-input-camera');
const connectCameraBtn = document.getElementById('connect-camera-btn');
const cameraConnectionStatus = document.getElementById('camera-connection-status');
const cameraConnectionLatency = document.getElementById('camera-connection-latency');
const cameraPreview = document.getElementById('camera-preview');
const cameraSelect = document.getElementById('camera-select');
const frontCameraRoleBtn = document.getElementById('front-camera-role');
const backCameraRoleBtn = document.getElementById('back-camera-role');
const applyCameraSettingsButton = document.getElementById('apply-camera-settings');

// DOM Elements - Client Mode
const carIdInputClient = document.getElementById('car-id-input-client');
const connectClientBtn = document.getElementById('connect-client-btn');
const clientConnectionStatus = document.getElementById('client-connection-status');
const clientConnectionLatency = document.getElementById('client-connection-latency');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const clientFrontView = document.getElementById('client-front-view');
const clientBackView = document.getElementById('client-back-view');
const clientFrontViewSmall = document.getElementById('client-front-view-small');
const clientBackViewSmall = document.getElementById('client-back-view-small');
const immersiveView = document.getElementById('immersive-view');
const allCamerasView = document.getElementById('all-cameras-view');

// Initialize the application
function initialize() {
  // Set up mode selection
  carModeBtn.addEventListener('click', () => switchMode('car'));
  cameraModeBtn.addEventListener('click', () => switchMode('camera'));
  clientModeBtn.addEventListener('click', () => switchMode('client'));

  // Set up camera role selection
  frontCameraRoleBtn.addEventListener('click', () => setCameraRole('front'));
  backCameraRoleBtn.addEventListener('click', () => setCameraRole('back'));
  
  // Initialize based on default mode (car mode)
  if (currentMode === 'car') {
    initializeCarMode();
  }
}

// Switch between modes
function switchMode(mode) {
  currentMode = mode;

  // Update UI
  carModeBtn.classList.remove('active');
  cameraModeBtn.classList.remove('active');
  clientModeBtn.classList.remove('active');
  carInterface.classList.add('hidden');
  cameraInterface.classList.add('hidden');
  clientInterface.classList.add('hidden');

  switch (mode) {
    case 'car':
      carModeBtn.classList.add('active');
      carInterface.classList.remove('hidden');
      initializeCarMode();
      break;
    case 'camera':
      cameraModeBtn.classList.add('active');
      cameraInterface.classList.remove('hidden');
      initializeCameraMode();
      break;
    case 'client':
      clientModeBtn.classList.add('active');
      clientInterface.classList.remove('hidden');
      initializeClientMode();
      break;
  }

  // Close existing connection when switching modes
  if (conn) {
    conn.close();
  }

  // Reset connection status
  isConnected = false;
  updateConnectionStatus();
}

// Set camera role (front or back)
function setCameraRole(role) {
  cameraRole = role;
  
  // Update UI
  frontCameraRoleBtn.classList.remove('active');
  backCameraRoleBtn.classList.remove('active');
  
  switch (role) {
    case 'front':
      frontCameraRoleBtn.classList.add('active');
      break;
    case 'back':
      backCameraRoleBtn.classList.add('active');
      break;
  }
}

// Generate a random ID for the car
function generateCarId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initialize PeerJS for car mode (server)
function initializeCarMode() {
  // Generate a new car ID if we don't have one
  if (!carId) {
    carId = generateCarId();
  }

  // Initialize PeerJS with the car ID
  initializePeer('carcal-' + carId);

  // Display the car ID (without prefix)
  carIdElement.textContent = carId;

  // Set up event listeners for car mode
  copyCarIdButton.addEventListener('click', () => {
    navigator.clipboard
      .writeText(carId)
      .then(() => {
        alert('Car ID copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy:', err);
      });
  });

  generateNewIdButton.addEventListener('click', () => {
    // Generate a new ID
    carId = generateCarId();
    carIdElement.textContent = carId;

    // Reinitialize peer with new ID
    initializePeer('carcal-' + carId);
    
    // Reset connected devices
    connectedCameras = {};
    connectedClients = {};
    updateConnectedDevicesLists();
  });
}

// Initialize PeerJS for camera mode
function initializeCameraMode() {
  // Get available cameras
  getAvailableCameras();

  // Initialize PeerJS with a random ID
  initializePeer();

  // Set up event listeners for camera mode
  connectCameraBtn.addEventListener('click', () => {
    const id = carIdInputCamera.value.trim();
    if (id) {
      connectToCar(id, 'camera');
    } else {
      alert('Please enter a Car ID');
    }
  });

  applyCameraSettingsButton.addEventListener('click', () => {
    applyCameraSettings();
  });
}

// Initialize PeerJS for client mode
function initializeClientMode() {
  // Initialize PeerJS with a random ID
  initializePeer();

  // Set up event listeners for client mode
  connectClientBtn.addEventListener('click', () => {
    const id = carIdInputClient.value.trim();
    if (id) {
      connectToCar(id, 'client');
    } else {
      alert('Please enter a Car ID');
    }
  });

  // Fullscreen button
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

// Initialize PeerJS
function initializePeer(specificId = null) {
  // Destroy existing peer if any
  if (peer) {
    peer.destroy();
  }

  // If specific ID is provided, use it
  if (specificId) {
    peer = new Peer(specificId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, // Google's public STUN server
        ],
      },
    });
  } else {
    peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, // Google's public STUN server
        ],
      },
    });
  }

  // When peer is open (connected to the signaling server)
  peer.on('open', (id) => {
    console.log('My peer ID is: ' + id);

    // If in car mode, update the car ID
    if (currentMode === 'car' && !specificId) {
      // Extract the ID without prefix
      const rawId = id.startsWith('carcal-') ? id.substring(7) : id;
      carId = rawId;
      carIdElement.textContent = carId;
    }
  });

  // Handle incoming data connection
  peer.on('connection', (dataConnection) => {
    if (currentMode === 'car') {
      handleCarConnection(dataConnection);
    }
  });

  // Handle incoming call (video)
  peer.on('call', async (call) => {
    console.log('Received call:', call);

    if (currentMode === 'car') {
      // In car mode, we're the server, so we need to handle incoming calls from cameras
      // and forward them to clients
      try {
        // Answer the call with an empty stream (we're just relaying)
        const emptyStream = createEmptyMediaStream();
        call.answer(emptyStream);
        
        // Get metadata to identify the camera
        const metadata = call.metadata || {};
        const cameraType = metadata.cameraType || 'unknown';
        const cameraPeerId = metadata.cameraPeerId || 'unknown';
        
        // Store the call for later use
        if (!connectedCameras[cameraPeerId]) {
          connectedCameras[cameraPeerId] = {};
        }
        connectedCameras[cameraPeerId][cameraType] = call;
        
        // Update the UI
        updateConnectedDevicesLists();
        
        // When we receive the stream from the camera
        call.on('stream', (cameraStream) => {
          console.log(`Received ${cameraType} camera stream from ${cameraPeerId}`);
          
          // Forward this stream to all connected clients
          forwardStreamToClients(cameraStream, cameraType);
        });
        
        call.on('close', () => {
          console.log(`${cameraType} camera from ${cameraPeerId} disconnected`);
          if (connectedCameras[cameraPeerId]) {
            delete connectedCameras[cameraPeerId][cameraType];
            if (Object.keys(connectedCameras[cameraPeerId]).length === 0) {
              delete connectedCameras[cameraPeerId];
            }
          }
          updateConnectedDevicesLists();
        });
        
      } catch (err) {
        console.error('Failed to handle camera call:', err);
      }
    } else if (currentMode === 'client') {
      // In client mode, we receive streams from the car server
      try {
        // Answer with an empty stream (we're just receiving)
        const emptyStream = createEmptyMediaStream();
        call.answer(emptyStream);
        
        // Get metadata to identify the camera type
        const metadata = call.metadata || {};
        const cameraType = metadata.cameraType || 'unknown';
        
        // When we receive the stream
        call.on('stream', (stream) => {
          console.log(`Received ${cameraType} stream as client`);
          
          // Display the stream in the appropriate video element
          if (cameraType === 'front') {
            clientFrontView.srcObject = stream;
            clientFrontViewSmall.srcObject = stream;
          } else if (cameraType === 'back') {
            clientBackView.srcObject = stream;
            clientBackViewSmall.srcObject = stream;
          }
        });
      } catch (err) {
        console.error('Failed to handle incoming stream as client:', err);
      }
    }
  });

  // Handle errors
  peer.on('error', (err) => {
    console.error('PeerJS error:', err);

    let statusElement;
    switch (currentMode) {
      case 'car':
        statusElement = carConnectionStatus;
        break;
      case 'camera':
        statusElement = cameraConnectionStatus;
        break;
      case 'client':
        statusElement = clientConnectionStatus;
        break;
    }
    
    if (statusElement) {
      statusElement.textContent = 'Error: ' + err.type;
    }

    // If the ID is already taken, generate a new one in car mode
    if (err.type === 'unavailable-id' && currentMode === 'car') {
      carId = generateCarId();
      carIdElement.textContent = carId;
      initializePeer('carcal-' + carId);
    }
  });
}

// Create an empty media stream (for answering calls)
function createEmptyMediaStream() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const stream = canvas.captureStream();
  return stream;
}

// Forward a camera stream to all connected clients
function forwardStreamToClients(stream, cameraType) {
  Object.keys(connectedClients).forEach(clientId => {
    const client = connectedClients[clientId];
    
    // Call the client with the camera stream
    const call = peer.call(clientId, stream, {
      metadata: { cameraType: cameraType }
    });
    
    // Store the call in the client object
    client[cameraType + 'Call'] = call;
    
    call.on('error', (err) => {
      console.error(`Error forwarding ${cameraType} stream to client ${clientId}:`, err);
    });
  });
}

// Update the lists of connected devices
function updateConnectedDevicesLists() {
  // Update connected cameras list
  if (Object.keys(connectedCameras).length === 0) {
    connectedCamerasList.innerHTML = '<li>No cameras connected</li>';
  } else {
    connectedCamerasList.innerHTML = '';
    Object.keys(connectedCameras).forEach(cameraPeerId => {
      const cameraTypes = Object.keys(connectedCameras[cameraPeerId]);
      const cameraItem = document.createElement('li');
      cameraItem.textContent = `Camera ${cameraPeerId.substring(0, 6)}... (${cameraTypes.join(', ')})`;
      connectedCamerasList.appendChild(cameraItem);
    });
  }
  
  // Update connected clients list
  if (Object.keys(connectedClients).length === 0) {
    connectedClientsList.innerHTML = '<li>No clients connected</li>';
  } else {
    connectedClientsList.innerHTML = '';
    Object.keys(connectedClients).forEach(clientId => {
      const clientItem = document.createElement('li');
      clientItem.textContent = `Client ${clientId.substring(0, 6)}...`;
      connectedClientsList.appendChild(clientItem);
    });
  }
}

// Get available cameras
async function getAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter((device) => device.kind === 'videoinput');

    // Populate camera select elements
    populateCameraSelects();

    // Initialize default camera stream
    await initializeCameraStream();
  } catch (err) {
    console.error('Failed to get available cameras:', err);
    alert('Failed to access cameras: ' + err.message);
  }
}

// Populate camera select elements
function populateCameraSelects() {
  // Clear existing options
  cameraSelect.innerHTML = '<option value="">None</option>';

  // Add camera options
  videoDevices.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  // Set default camera
  if (videoDevices.length > 0) {
    cameraSelect.selectedIndex = 1; // First camera
  }
}

// Initialize camera stream with default device
async function initializeCameraStream() {
  try {
    if (cameraSelect.value) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: cameraSelect.value
            ? { exact: cameraSelect.value }
            : undefined,
        },
      });
      cameraPreview.srcObject = cameraStream;
    }
  } catch (err) {
    console.error('Failed to initialize camera stream:', err);
    alert('Failed to access camera: ' + err.message);
  }
}

// Apply selected camera settings
async function applyCameraSettings() {
  // Stop current stream
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  try {
    if (cameraSelect.value) {
      // Get camera stream
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: cameraSelect.value
            ? { exact: cameraSelect.value }
            : undefined,
        },
      });
      cameraPreview.srcObject = cameraStream;
      
      // If connected to a car, update the stream
      if (isConnected && conn) {
        // Notify car that camera stream has changed
        conn.send({
          type: 'camera-stream-updated',
          cameraRole: cameraRole
        });
        
        // Send the new stream to the car
        sendCameraStream();
      }
    }
  } catch (err) {
    console.error('Failed to apply camera settings:', err);
    alert('Failed to apply camera settings: ' + err.message);
  }
}

// Handle connection as a car (server)
function handleCarConnection(dataConnection) {
  const connectionId = dataConnection.peer;
  
  dataConnection.on('open', () => {
    console.log('New connection from:', connectionId);
    
    // Ask for connection type
    dataConnection.send({
      type: 'connection-type-request'
    });
  });
  
  dataConnection.on('data', (data) => {
    console.log('Received data:', data);
    
    if (data.type === 'connection-type') {
      if (data.connectionType === 'camera') {
        // This is a camera connection
        handleCameraConnection(dataConnection, data);
      } else if (data.connectionType === 'client') {
        // This is a client connection
        handleClientConnection(dataConnection);
      }
    }
    
    // Handle ping/pong for latency measurement
    handleIncomingData(data, dataConnection);
  });
  
  dataConnection.on('close', () => {
    console.log('Connection closed:', connectionId);
    
    // Check if this was a camera
    if (Object.keys(connectedCameras).includes(connectionId)) {
      delete connectedCameras[connectionId];
    }
    
    // Check if this was a client
    if (Object.keys(connectedClients).includes(connectionId)) {
      delete connectedClients[connectionId];
    }
    
    updateConnectedDevicesLists();
  });
}

// Handle a camera connection to the car server
function handleCameraConnection(dataConnection, data) {
  const cameraPeerId = dataConnection.peer;
  const cameraType = data.cameraRole || 'unknown';
  
  console.log(`New camera connection (${cameraType}) from:`, cameraPeerId);
  
  // Store the connection
  if (!connectedCameras[cameraPeerId]) {
    connectedCameras[cameraPeerId] = {};
  }
  connectedCameras[cameraPeerId].connection = dataConnection;
  connectedCameras[cameraPeerId].type = cameraType;
  
  // Update UI
  updateConnectedDevicesLists();
  
  // Send acknowledgment
  dataConnection.send({
    type: 'camera-connection-accepted',
    cameraType: cameraType
  });
}

// Handle a client connection to the car server
function handleClientConnection(dataConnection) {
  const clientId = dataConnection.peer;
  
  console.log('New client connection from:', clientId);
  
  // Store the connection
  connectedClients[clientId] = {
    connection: dataConnection
  };
  
  // Update UI
  updateConnectedDevicesLists();
  
  // Send acknowledgment
  dataConnection.send({
    type: 'client-connection-accepted'
  });
}

// Connect to a car as a camera or client
function connectToCar(carIdValue, connectionType) {
  // Add prefix if not already present
  const fullCarId = carIdValue.startsWith('carcal-')
    ? carIdValue
    : 'carcal-' + carIdValue;

  // Create data connection
  const dataConnection = peer.connect(fullCarId);

  dataConnection.on('open', () => {
    conn = dataConnection;
    isConnected = true;
    updateConnectionStatus();
    console.log('Connected to car:', conn.peer);

    // Start ping for latency measurement
    startPingMeasurement();
    
    // Identify connection type to the car
    conn.send({
      type: 'connection-type',
      connectionType: connectionType,
      cameraRole: cameraRole
    });
    
    // If this is a camera connection, send the camera stream
    if (connectionType === 'camera') {
      sendCameraStream();
    }
  });

  dataConnection.on('data', (data) => {
    handleIncomingData(data, dataConnection);
  });

  dataConnection.on('close', () => {
    conn = null;
    isConnected = false;
    updateConnectionStatus();
    console.log('Connection closed');

    // Stop ping measurement
    clearInterval(pingInterval);
  });

  dataConnection.on('error', (err) => {
    console.error('Connection error:', err);
    
    if (connectionType === 'camera') {
      cameraConnectionStatus.textContent = 'Error: ' + err;
    } else {
      clientConnectionStatus.textContent = 'Error: ' + err;
    }
  });
}

// Send camera stream to the car server
function sendCameraStream() {
  if (!isConnected || !conn || !cameraStream) {
    console.error('Cannot send camera stream: not connected or no stream available');
    return;
  }
  
  console.log(`Sending ${cameraRole} camera stream to car`);
  
  // Call the car with our camera stream
  const call = peer.call(conn.peer, cameraStream, {
    metadata: {
      cameraType: cameraRole,
      cameraPeerId: peer.id
    }
  });
  
  call.on('error', (err) => {
    console.error('Error sending camera stream:', err);
  });
}

// Handle incoming data
function handleIncomingData(data, dataConnection) {
  // Handle ping/pong for latency measurement
  if (data.type === 'ping') {
    // Send pong back immediately
    dataConnection.send({
      type: 'pong',
      id: data.id,
      timestamp: data.timestamp,
    });
    return;
  } else if (data.type === 'pong') {
    // Calculate latency
    const now = Date.now();
    const pingTime = now - data.timestamp;
    currentLatency = pingTime;

    let latencyElement;
    switch (currentMode) {
      case 'car':
        latencyElement = carConnectionLatency;
        break;
      case 'camera':
        latencyElement = cameraConnectionLatency;
        break;
      case 'client':
        latencyElement = clientConnectionLatency;
        break;
    }
    
    if (latencyElement) {
      latencyElement.textContent = pingTime + ' ms';
    }
    return;
  } else if (data.type === 'camera-stream-updated' && currentMode === 'camera') {
    // If camera stream was updated, send it again
    sendCameraStream();
  } else if (data.type === 'camera-connection-accepted' && currentMode === 'camera') {
    console.log('Camera connection accepted by car server');
  } else if (data.type === 'client-connection-accepted' && currentMode === 'client') {
    console.log('Client connection accepted by car server');
  }
  
  console.log('Received data:', data);
}

// Start ping measurement for latency
function startPingMeasurement() {
  // Clear existing interval if any
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  // Send ping every 2 seconds
  pingInterval = setInterval(() => {
    if (isConnected && conn) {
      lastPingTime = Date.now();
      conn.send({
        type: 'ping',
        id: Math.random().toString(36).substring(2, 15),
        timestamp: lastPingTime,
      });
    }
  }, 2000);
}

// Update connection status display
function updateConnectionStatus() {
  let statusElement;
  let latencyElement;
  
  switch (currentMode) {
    case 'car':
      statusElement = carConnectionStatus;
      latencyElement = carConnectionLatency;
      break;
    case 'camera':
      statusElement = cameraConnectionStatus;
      latencyElement = cameraConnectionLatency;
      break;
    case 'client':
      statusElement = clientConnectionStatus;
      latencyElement = clientConnectionLatency;
      break;
  }
  
  if (!statusElement || !latencyElement) return;

  if (isConnected) {
    switch (currentMode) {
      case 'car':
        statusElement.textContent = 'Connected';
        break;
      case 'camera':
        statusElement.textContent = 'Connected to car';
        break;
      case 'client':
        statusElement.textContent = 'Connected to car';
        break;
    }
    statusElement.classList.add('connected');
  } else {
    switch (currentMode) {
      case 'car':
        statusElement.textContent = 'Waiting for connection...';
        break;
      case 'camera':
        statusElement.textContent = 'Disconnected';
        break;
      case 'client':
        statusElement.textContent = 'Disconnected';
        break;
    }
    statusElement.classList.remove('connected');
    latencyElement.textContent = '-- ms';
  }
}

// Toggle fullscreen mode
function toggleFullscreen() {
  const viewContainer = document.getElementById('client-view-container');

  if (!document.fullscreenElement) {
    // Enter fullscreen
    if (viewContainer.requestFullscreen) {
      viewContainer.requestFullscreen();
    } else if (viewContainer.webkitRequestFullscreen) {
      viewContainer.webkitRequestFullscreen();
    } else if (viewContainer.msRequestFullscreen) {
      viewContainer.msRequestFullscreen();
    }

    fullscreenBtn.textContent = 'Exit Fullscreen';
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    viewContainer.classList.remove('fullscreen-mode');
    fullscreenBtn.textContent = 'Enter Fullscreen';
  }
}

document.addEventListener('fullscreenchange', (event) => {
  const viewContainer = document.getElementById('client-view-container');
  viewContainer.classList.toggle('fullscreen-mode');
});

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);