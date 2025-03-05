import { PEER_CONFIG, VIEW_PREFIX } from './config.js';
import { generateViewId, createEmptyMediaStream } from './utils.js';

export class ViewMode {
  constructor() {
    this.peer = null;
    this.viewId = '';
    this.connectedCameras = {};
    this.currentLatency = 0;
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.clientIdElement = document.getElementById('client-id');
    this.copyClientIdButton = document.getElementById('copy-client-id');
    this.generateNewIdButton = document.getElementById('generate-new-id');
    this.clientConnectionStatus = document.getElementById('client-connection-status');
    this.clientConnectionLatency = document.getElementById('client-connection-latency');
    this.connectedCamerasList = document.getElementById('connected-cameras-list');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.clientFrontView = document.getElementById('client-front-view');
    this.clientBackView = document.getElementById('client-back-view');
  }

  setupEventListeners() {
    this.copyClientIdButton.addEventListener('click', () => {
      navigator.clipboard
        .writeText(this.viewId)
        .then(() => {
          alert('View ID copied to clipboard');
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
        });
    });

    this.generateNewIdButton.addEventListener('click', () => {
      this.viewId = generateViewId();
      this.clientIdElement.textContent = this.viewId;
      this.initializePeer();
      this.connectedCameras = {};
      this.updateConnectedCamerasList();
    });

    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
  }

  initialize() {
    this.viewId = generateViewId();
    this.initializePeer();
  }

  initializePeer() {
    if (this.peer) {
      this.peer.destroy();
    }

    this.peer = new Peer(VIEW_PREFIX + this.viewId, PEER_CONFIG);

    this.peer.on('open', (id) => {
      console.log('View peer ID:', id);
      this.clientIdElement.textContent = this.viewId;
    });

    this.peer.on('connection', (dataConnection) => {
      this.handleViewConnection(dataConnection);
    });

    this.peer.on('call', async (call) => {
      this.handleIncomingCall(call);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'unavailable-id') {
        this.viewId = generateViewId();
        this.clientIdElement.textContent = this.viewId;
        this.initializePeer();
      }
      this.clientConnectionStatus.textContent = 'Error: ' + err.type;
    });
  }

  handleViewConnection(dataConnection) {
    const connectionId = dataConnection.peer;
    
    dataConnection.on('open', () => {
      console.log('New camera connection from:', connectionId);
      
      this.connectedCameras[connectionId] = {
        connection: dataConnection
      };
      
      this.updateConnectedCamerasList();
      
      dataConnection.send({
        type: 'connection-accepted'
      });
    });
    
    dataConnection.on('data', (data) => {
      this.handleIncomingData(data, dataConnection);
    });
    
    dataConnection.on('close', () => {
      console.log('Camera disconnected:', connectionId);
      delete this.connectedCameras[connectionId];
      this.updateConnectedCamerasList();
    });
  }

  async handleIncomingCall(call) {
    try {
      const emptyStream = createEmptyMediaStream();
      call.answer(emptyStream);
      
      const metadata = call.metadata || {};
      const cameraType = metadata.cameraType || 'unknown';
      
      call.on('stream', (stream) => {
        console.log(`Received ${cameraType} stream`);
        
        if (cameraType === 'front') {
          this.clientFrontView.srcObject = stream;
        } else if (cameraType === 'back') {
          this.clientBackView.srcObject = stream;
        }
      });
    } catch (err) {
      console.error('Failed to handle incoming call:', err);
    }
  }

  handleIncomingData(data, dataConnection) {
    if (data.type === 'ping') {
      dataConnection.send({
        type: 'pong',
        id: data.id,
        timestamp: data.timestamp
      });
    } else if (data.type === 'pong') {
      const now = Date.now();
      const pingTime = now - data.timestamp;
      this.currentLatency = pingTime;
      this.clientConnectionLatency.textContent = pingTime + ' ms';
    }
  }

  updateConnectedCamerasList() {
    const cameras = Object.keys(this.connectedCameras);
    if (cameras.length === 0) {
      this.connectedCamerasList.innerHTML = '<li>No cameras connected</li>';
    } else {
      this.connectedCamerasList.innerHTML = '';
      cameras.forEach(cameraPeerId => {
        const cameraItem = document.createElement('li');
        cameraItem.textContent = `Connected Camera`;
        this.connectedCamerasList.appendChild(cameraItem);
      });
    }
  }

  toggleFullscreen() {
    const viewContainer = document.getElementById('client-view-container');

    if (!document.fullscreenElement) {
      if (viewContainer.requestFullscreen) {
        viewContainer.requestFullscreen();
      } else if (viewContainer.webkitRequestFullscreen) {
        viewContainer.webkitRequestFullscreen();
      } else if (viewContainer.msRequestFullscreen) {
        viewContainer.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  handleFullscreenChange() {
    const viewContainer = document.getElementById('client-view-container');
    viewContainer.classList.toggle('fullscreen-mode');
    this.fullscreenBtn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen';
  }
}