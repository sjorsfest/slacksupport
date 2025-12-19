import type { LoaderFunctionArgs } from "react-router";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

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

  // Create container with shadow DOM
  container = document.createElement('div');
  container.id = 'support-widget-container';
  var shadow = container.attachShadow({ mode: 'closed' });
  
  // Inject styles
  var styles = document.createElement('style');
  styles.textContent = \`
    * {
      box-sizing: border-box;
    }
    
    .sw-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: \${config.primaryColor || '#4A154B'};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      z-index: 2147483646;
    }
    
    .sw-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
    
    .sw-button svg {
      width: 28px;
      height: 28px;
      fill: white;
      transition: transform 0.2s ease;
    }
    
    .sw-button.open svg.chat-icon {
      display: none;
    }
    
    .sw-button.open svg.close-icon {
      display: block;
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
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: #E01E5A;
      color: white;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: none;
      align-items: center;
      justify-content: center;
    }
    
    .sw-badge.visible {
      display: flex;
    }
    
    .sw-frame-container {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 380px;
      height: 520px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      transition: opacity 0.2s ease, transform 0.2s ease;
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
    }
    
    @media (max-width: 480px) {
      .sw-frame-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
      }
      
      .sw-frame-container.open ~ .sw-button {
        display: none;
      }
    }
  \`;
  shadow.appendChild(styles);
  
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
  
  // Toggle widget
  function toggle() {
    isOpen = !isOpen;
    button.classList.toggle('open', isOpen);
    frameContainer.classList.toggle('open', isOpen);
    button.setAttribute('aria-label', isOpen ? 'Close support chat' : 'Open support chat');
    
    if (isOpen) {
      unreadCount = 0;
      updateBadge();
      // Notify iframe
      iframe.contentWindow.postMessage({ type: 'sw:opened' }, BASE_URL);
    }
  }
  
  function updateBadge() {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
    badge.classList.toggle('visible', unreadCount > 0 && !isOpen);
  }
  
  // Event listeners
  button.addEventListener('click', toggle);
  
  // Handle messages from iframe
  window.addEventListener('message', function(event) {
    if (event.origin !== BASE_URL) return;
    
    var data = event.data;
    if (!data || !data.type) return;
    
    switch (data.type) {
      case 'sw:close':
        if (isOpen) toggle();
        break;
      case 'sw:newMessage':
        if (!isOpen) {
          unreadCount++;
          updateBadge();
        }
        break;
      case 'sw:ready':
        // Widget frame is ready
        break;
    }
  });
  
  // Append to document
  document.body.appendChild(container);
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
