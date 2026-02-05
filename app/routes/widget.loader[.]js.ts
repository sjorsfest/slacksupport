import type { LoaderFunctionArgs } from "react-router";
import { settings } from "~/lib/settings.server";

const BASE_URL = settings.BASE_URL;

/**
 * GET /widget/loader.js
 * Returns the widget loader script that customers embed on their site.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const loaderScript = `
(function() {
  'use strict';
  
  // Get configuration from global
  var config = window.SupportWidget || {};
  if (!config.accountId) {
    console.error('SupportWidget: Missing accountId');
    return;
  }

  var BASE_URL = '${BASE_URL}';
  var WIDGET_FRAME_URL = BASE_URL + '/widget/frame';
  
  // Generate or retrieve visitor ID
  var visitorId = localStorage.getItem('sw_visitor_id');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('sw_visitor_id', visitorId);
  }
  
  // State
  var isOpen = false;
  var unreadCount = 0;
  var iframe = null;
  var container = null;
  var button = null;
  var badge = null;
  var tooltip = null;

  // Create container with shadow DOM (reuse if provided by host page)
  container = document.getElementById('support-widget-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'support-widget-container';
    document.body.appendChild(container);
  }
  var shadow = container.attachShadow({ mode: 'closed' });
  
  // Inject styles
  var styles = document.createElement('style');
  styles.textContent = \`
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    :host {
      --sw-primary: \${config.primaryColor || '#FF4FA3'};
      --sw-primary-light: \${config.primaryColor ? config.primaryColor + '33' : '#FF4FA333'};
    }
    
    .sw-button {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--sw-primary);
      border: 3px solid #1a1a1a;
      cursor: pointer;
      box-shadow: 
        3px 3px 0px 0px #1a1a1a,
        0 0 0 0 var(--sw-primary-light);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      visibility: hidden;
      opacity: 0;
      transform: scale(0) translateY(20px);
      pointer-events: none;
    }
    
    .sw-button.ready {
      visibility: visible;
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
      animation: sw-button-pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, sw-bounce-idle 3s ease-in-out 0.5s infinite;
    }
    
    .sw-button:hover {
      transform: scale(1.02) rotate(-4deg);
      box-shadow: 
        4px 4px 0px 0px #1a1a1a,
        0 0 0 6px var(--sw-primary-light);
      animation: sw-wiggle 0.4s ease-in-out;
    }
    
    .sw-button:active {
      transform: scale(0.92) rotate(0deg);
      box-shadow: 
        1px 1px 0px 0px #1a1a1a,
        0 0 0 10px var(--sw-primary-light);
      transition: 
        transform 0.1s ease,
        box-shadow 0.1s ease;
    }
    
    .sw-button.clicked {
      animation: sw-celebrate 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .sw-button svg {
      width: 34px;
      height: 34px;
      fill: white;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      filter: drop-shadow(2px 2px 0px rgba(0,0,0,0.2));
    }
    
    .sw-button:hover svg {
      transform: scale(1.1);
    }
    
    .sw-button.open {
      transform: rotate(0);
      background: #1f2937;
      box-shadow: 
        3px 3px 0px 0px #1a1a1a,
        0 0 0 0 transparent;
      animation: none;
    }
    
    .sw-button.open:hover {
      transform: scale(1.05) rotate(0);
      box-shadow: 
        4px 4px 0px 0px #1a1a1a,
        0 0 0 5px rgba(31, 41, 55, 0.2);
    }
    
    .sw-button.open svg.chat-icon {
      display: none;
    }
    
    .sw-button.open svg.close-icon {
      display: block;
      animation: sw-spin-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .sw-button:not(.open) svg.chat-icon {
      display: block;
    }
    
    .sw-button:not(.open) svg.close-icon {
      display: none;
    }
    
    .sw-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 26px;
      height: 26px;
      padding: 0 7px;
      border-radius: 999px;
      background: #ef4444;
      color: white;
      font-size: 13px;
      font-weight: 800;
      font-family: "Nunito", sans-serif;
      display: none;
      align-items: center;
      justify-content: center;
      border: 2px solid #1a1a1a;
      box-shadow: 2px 2px 0px 0px #1a1a1a;
      animation: sw-badge-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    .sw-badge.visible {
      display: flex;
      animation: sw-badge-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), sw-badge-pulse 2s ease-in-out infinite 0.4s;
    }

    .sw-tooltip {
      position: fixed;
      bottom: 110px;
      right: 24px;
      background: white;
      padding: 14px 22px;
      border-radius: 20px;
      border-bottom-right-radius: 6px;
      border: 2px solid #1a1a1a;
      box-shadow: 3px 3px 0px 0px #1a1a1a;
      font-family: "Nunito", sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #1a1a1a;
      pointer-events: none;
      opacity: 0;
      transform: translateY(10px) scale(0.9);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2147483645;
      max-width: 220px;
    }

    .sw-tooltip.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      animation: sw-tooltip-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .sw-frame-container {
      position: fixed;
      bottom: 112px;
      right: 24px;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 130px);
      border-radius: 24px;
      overflow: hidden;
      line-height: 0;
      box-shadow: 0 0 0 3px #1a1a1a, 4px 4px 0px 0px #1a1a1a;
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      transform-origin: bottom right;
      transition: 
        opacity 0.25s ease, 
        transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.3s ease;
      pointer-events: none;
      z-index: 2147483645;
    }
    
    .sw-frame-container.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    
    .sw-frame {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 24px;
    }

    /* Animations */
    @keyframes sw-bounce-idle {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    
    @keyframes sw-wiggle {
      0%, 100% { transform: scale(1.02) rotate(-4deg); }
      25% { transform: scale(1.02) rotate(4deg); }
      50% { transform: scale(1.02) rotate(-3deg); }
      75% { transform: scale(1.02) rotate(3deg); }
    }
    
    @keyframes sw-celebrate {
      0% { transform: scale(0.92); }
      30% { transform: scale(1.15) rotate(-10deg); }
      50% { transform: scale(1.1) rotate(8deg); }
      70% { transform: scale(1.12) rotate(-5deg); }
      100% { transform: scale(1) rotate(0); }
    }
    
    @keyframes sw-spin-in {
      0% { transform: rotate(0deg) scale(0.5); }
      100% { transform: rotate(180deg) scale(1); }
    }

    @keyframes sw-badge-pop {
      0% { transform: scale(0) rotate(-45deg); }
      50% { transform: scale(1.3) rotate(10deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    
    @keyframes sw-badge-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    @keyframes sw-tooltip-bounce {
      0% { transform: translateY(10px) scale(0.9); }
      50% { transform: translateY(-5px) scale(1.02); }
      100% { transform: translateY(0) scale(1); }
    }
    
    @keyframes sw-button-pop-in {
      0% {
        opacity: 0;
        transform: scale(0) translateY(20px);
      }
      50% {
        opacity: 1;
        transform: scale(1.15) translateY(-5px);
      }
      75% {
        transform: scale(0.95) translateY(2px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    /* Tablet screens */
    @media (max-width: 768px) {
      .sw-button {
        width: 64px;
        height: 64px;
        bottom: 20px;
        right: 20px;
        border-width: 3px;
        box-shadow: 3px 3px 0px 0px #1a1a1a;
      }
      
      .sw-button svg {
        width: 30px;
        height: 30px;
      }
      
      .sw-badge {
        min-width: 24px;
        height: 24px;
        font-size: 12px;
        border-width: 2px;
        box-shadow: 2px 2px 0px 0px #1a1a1a;
      }
      
      .sw-tooltip {
        bottom: 96px;
        right: 20px;
        padding: 12px 18px;
        font-size: 14px;
      }
      
      .sw-frame-container {
        bottom: 100px;
        right: 20px;
        width: 340px;
        box-shadow: 3px 3px 0px 0px #1a1a1a;
      }
    }
    
    /* Mobile screens */
    @media (max-width: 480px) {
      .sw-button {
        width: 56px;
        height: 56px;
        bottom: 16px;
        right: 16px;
        border-width: 2px;
        box-shadow: 2px 2px 0px 0px #1a1a1a;
      }
      
      .sw-button:hover {
        box-shadow: 
          3px 3px 0px 0px #1a1a1a,
          0 0 0 5px var(--sw-primary-light);
      }
      
      .sw-button svg {
        width: 26px;
        height: 26px;
      }
      
      .sw-badge {
        min-width: 22px;
        height: 22px;
        font-size: 11px;
        border-width: 2px;
        top: -3px;
        right: -3px;
        box-shadow: 1px 1px 0px 0px #1a1a1a;
      }
      
      .sw-tooltip {
        bottom: 82px;
        right: 16px;
        padding: 10px 16px;
        font-size: 13px;
        border-width: 2px;
        box-shadow: 2px 2px 0px 0px #1a1a1a;
      }
      
      .sw-frame-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        border: none;
        box-shadow: none;
        z-index: 2147483647;
      }
      
      .sw-frame-container.open ~ .sw-button {
        display: none;
      }
    }
    
    /* Extra small screens */
    @media (max-width: 360px) {
      .sw-button {
        width: 50px;
        height: 50px;
        bottom: 12px;
        right: 12px;
        box-shadow: 2px 2px 0px 0px #1a1a1a;
      }
      
      .sw-button svg {
        width: 24px;
        height: 24px;
      }
      
      .sw-badge {
        min-width: 20px;
        height: 20px;
        font-size: 10px;
      }
      
      .sw-tooltip {
        bottom: 72px;
        right: 12px;
      }
    }
  \`;
  shadow.appendChild(styles);

  function normalizeHexColor(value) {
    if (!value || typeof value !== 'string') return null;
    var hex = value.trim().toLowerCase();
    if (hex.charAt(0) !== '#') return null;
    hex = hex.slice(1);
    if (hex.length === 3) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }
    if (hex.length !== 6) return null;
    return '#' + hex;
  }

  function setPrimaryColor(value) {
    if (!container || !value) return;
    var normalized = normalizeHexColor(value);
    if (normalized) {
      container.style.setProperty('--sw-primary', normalized);
      container.style.setProperty('--sw-primary-light', normalized + '33');
      return;
    }
    container.style.setProperty('--sw-primary', value);
  }

  
  // Create button
  button = document.createElement('button');
  button.className = 'sw-button';
  button.setAttribute('aria-label', 'Open support chat');
  button.innerHTML = \`
    <svg class="chat-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </svg>
    <svg class="close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  \`;
  
  // Create badge
  badge = document.createElement('span');
  badge.className = 'sw-badge';
  badge.textContent = '0';
  button.appendChild(badge);

  // Create tooltip
  tooltip = document.createElement('div');
  tooltip.className = 'sw-tooltip';
  tooltip.textContent = '👋 Chat with us!';
  
  // Create frame container
  var frameContainer = document.createElement('div');
  frameContainer.className = 'sw-frame-container';
  
  // Create iframe
  var iframeSrc = WIDGET_FRAME_URL + '?accountId=' + encodeURIComponent(config.accountId) + 
    '&visitorId=' + encodeURIComponent(visitorId);
  
  // Add metadata if provided
  if (config.metadata) {
    iframeSrc += '&metadata=' + encodeURIComponent(JSON.stringify(config.metadata));
  }
  if (config.email) {
    iframeSrc += '&email=' + encodeURIComponent(config.email);
  }
  if (config.name) {
    iframeSrc += '&name=' + encodeURIComponent(config.name);
  }
  
  iframe = document.createElement('iframe');
  iframe.className = 'sw-frame';
  iframe.src = iframeSrc;
  iframe.setAttribute('title', 'Support Chat');
  iframe.setAttribute('allow', 'microphone');
  
  frameContainer.appendChild(iframe);
  shadow.appendChild(frameContainer);
  shadow.appendChild(button);
  shadow.appendChild(tooltip);
  
  var controlledByHost = !!config.controlledByHost;
  if (typeof config.controlledByHost === 'undefined' && typeof config.widgetIsOpen === 'boolean') {
    controlledByHost = true;
  }
  var desiredOpen = controlledByHost && typeof config.widgetIsOpen === 'boolean'
    ? config.widgetIsOpen
    : false;
  var lastExternalOpen = desiredOpen;
  
  if (controlledByHost) {
    button.style.display = 'none';
    tooltip.style.display = 'none';
    frameContainer.style.setProperty('bottom', '24px', 'important');
    frameContainer.style.setProperty('max-height', 'calc(100vh - 48px)', 'important');
  }
  

  
  // Fetch widget config from server to get correct accent color
  // Also add a minimum delay before showing button for better UX
  var CONFIG_URL = BASE_URL + '/widget/config.json?accountId=' + encodeURIComponent(config.accountId);
  var configPromise = fetch(CONFIG_URL)
    .then(function(response) {
      if (response.ok) return response.json();
      return null;
    })
    .catch(function(err) {
      console.warn('SupportWidget: Could not fetch config', err);
      return null;
    });
  
  var delayPromise = new Promise(function(resolve) {
    setTimeout(resolve, 2500);
  });
  
  // Wait for both the delay and the config fetch before showing button
  Promise.all([configPromise, delayPromise]).then(function(results) {
    var serverConfig = results[0];
    
    if (!serverConfig) {
      if (!controlledByHost) {
        showError('Support Widget: Failed to load configuration');
      }
      return;
    }
    
    if (serverConfig.error) {
      if (!controlledByHost) {
        showError('Support Widget: ' + serverConfig.error);
      }
      return;
    }

    if (serverConfig.primaryColor) {
      setPrimaryColor(serverConfig.primaryColor);
    }
    
    // Show button with pop-in animation after colors are loaded and delay passed
    if (!controlledByHost) {
      button.classList.add('ready');
      
      // Show tooltip shortly after button appears
      setTimeout(() => {
        if (!isOpen) {
          tooltip.classList.add('visible');
          setTimeout(() => {
            tooltip.classList.remove('visible');
          }, 5000);
        }
      }, 6000);
    }
  });

  function showError(message) {
    var errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 16px;background:#fee2e2;color:#b91c1c;border:1px solid #f87171;border-radius:12px;font-family:sans-serif;font-size:14px;font-weight:600;z-index:2147483647;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);opacity:0;transform:translateY(10px);transition:all 0.3s ease;';
    errorDiv.textContent = message;
    shadow.appendChild(errorDiv);
    
    // Animate in
    setTimeout(function() {
      errorDiv.style.opacity = '1';
      errorDiv.style.transform = 'translateY(0)';
    }, 10);
    
    // Auto remove after 10s
    setTimeout(function() {
      errorDiv.style.opacity = '0';
      errorDiv.style.transform = 'translateY(10px)';
      setTimeout(function() {
        if (errorDiv.parentNode) errorDiv.parentNode.removeChild(errorDiv);
      }, 300);
    }, 10000);
  }
  
  // Toggle widget
  function setOpen(nextOpen, animateClick) {
    if (nextOpen === isOpen) return;
    isOpen = nextOpen;
    
    if (controlledByHost) {
      lastExternalOpen = nextOpen;
      try {
        if (window.SupportWidget && typeof window.SupportWidget === 'object') {
          window.SupportWidget.widgetIsOpen = nextOpen;
        }
      } catch (error) {
        // Ignore assignment failures
      }
    }

    if (animateClick) {
      // Add celebration animation on click
      button.classList.add('clicked');
      setTimeout(function() {
        button.classList.remove('clicked');
      }, 600);
    }
    
    button.classList.toggle('open', isOpen);
    frameContainer.classList.toggle('open', isOpen);
    button.setAttribute('aria-label', isOpen ? 'Close support chat' : 'Open support chat');
    
    if (isOpen) {
      tooltip.classList.remove('visible');
      unreadCount = 0;
      updateBadge();
      // Notify iframe
      iframe.contentWindow.postMessage({ type: 'sw:opened' }, BASE_URL);
    }
  }

  function toggle() {
    setOpen(!isOpen, true);
  }
  
  function updateBadge() {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
    badge.classList.toggle('visible', unreadCount > 0 && !isOpen);
  }
  
  // Event listeners
  if (!controlledByHost) {
    button.addEventListener('click', toggle);
  }
  
  // Handle messages from iframe
  window.addEventListener('message', function(event) {
    if (event.origin !== BASE_URL) return;
    
    var data = event.data;
    if (!data || !data.type) return;
    
    switch (data.type) {
      case 'sw:close':
        if (isOpen) setOpen(false, false);
        break;
      case 'sw:newMessage':
        if (!isOpen) {
          unreadCount++;
          updateBadge();
          // Show tooltip on new message
          if (!controlledByHost) {
            tooltip.textContent = 'New message! 💬';
            tooltip.classList.add('visible');
            setTimeout(() => tooltip.classList.remove('visible'), 5000);
          }
        }
        break;
      case 'sw:ready':
        // Widget frame is ready
        if (data.primaryColor) {
          setPrimaryColor(data.primaryColor);
        }
        break;
    }
  });
  
  // Append to document if it was created dynamically
  // (If the host page provided the container, it's already in the DOM.)
  
  if (controlledByHost) {
    setOpen(desiredOpen, false);
    setInterval(function() {
      var hostConfig = window.SupportWidget || {};
      var nextOpen = typeof hostConfig.widgetIsOpen === 'boolean' ? hostConfig.widgetIsOpen : null;
      if (typeof nextOpen !== 'boolean') return;
      if (nextOpen !== lastExternalOpen) {
        setOpen(nextOpen, false);
      }
    }, 300);
  }
})();
`;

  return new Response(loaderScript, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
