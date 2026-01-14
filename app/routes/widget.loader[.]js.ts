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

  // Create container with shadow DOM
  container = document.createElement('div');
  container.id = 'support-widget-container';
  var shadow = container.attachShadow({ mode: 'closed' });
  
  // Inject styles
  var styles = document.createElement('style');
  styles.textContent = \`
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    .sw-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), transparent 60%),
        \${config.accentColor || '#FF4FA3'};
      border: 2px solid rgba(255, 255, 255, 0.3);
      cursor: pointer;
      box-shadow: 
        0 10px 25px -5px rgba(255, 79, 163, 0.5),
        0 8px 10px -6px rgba(255, 79, 163, 0.3),
        inset 0 -5px 10px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2147483646;
      animation: sw-float 6s ease-in-out infinite;
    }
    
    .sw-button:hover {
      transform: scale(1.1) rotate(-5deg);
      box-shadow: 
        0 15px 30px -5px rgba(255, 79, 163, 0.6),
        0 10px 15px -5px rgba(255, 79, 163, 0.4),
        inset 0 -5px 10px rgba(0, 0, 0, 0.1);
    }
    
    .sw-button:active {
      transform: scale(0.95);
    }
    
    .sw-button svg {
      width: 32px;
      height: 32px;
      fill: white;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    
    .sw-button.open {
      transform: rotate(0);
      background: #1f2937;
      box-shadow: 0 10px 25px -5px rgba(31, 41, 55, 0.5);
    }
    
    .sw-button.open svg.chat-icon {
      display: none;
    }
    
    .sw-button.open svg.close-icon {
      display: block;
      transform: rotate(90deg);
    }
    
    .sw-button:not(.open) svg.chat-icon {
      display: block;
    }
    
    .sw-button:not(.open) svg.close-icon {
      display: none;
    }
    
    .sw-badge {
      position: absolute;
      top: 0;
      right: 0;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: #ef4444;
      color: white;
      font-size: 12px;
      font-weight: 700;
      font-family: "Nunito", sans-serif;
      display: none;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      animation: sw-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    .sw-badge.visible {
      display: flex;
    }

    .sw-tooltip {
      position: fixed;
      bottom: 95px;
      right: 20px;
      background: white;
      padding: 12px 20px;
      border-radius: 16px;
      border-bottom-right-radius: 4px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      font-family: "Nunito", sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      pointer-events: none;
      opacity: 0;
      transform: translateY(10px) scale(0.9);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2147483645;
      max-width: 200px;
    }

    .sw-tooltip.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    
    .sw-frame-container {
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 120px);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 
        0 25px 50px -12px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(0, 0, 0, 0.05);
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      transform-origin: bottom right;
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
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

    @keyframes sw-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }

    @keyframes sw-pop {
      0% { transform: scale(0); }
      100% { transform: scale(1); }
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
        max-height: 100%;
        border-radius: 0;
        z-index: 2147483647;
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
  
  // Show tooltip after delay
  setTimeout(() => {
    if (!isOpen) {
      tooltip.classList.add('visible');
      setTimeout(() => {
        tooltip.classList.remove('visible');
      }, 5000);
    }
  }, 2000);
  
  // Toggle widget
  function toggle() {
    isOpen = !isOpen;
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
          // Show tooltip on new message
          tooltip.textContent = 'New message! 💬';
          tooltip.classList.add('visible');
          setTimeout(() => tooltip.classList.remove('visible'), 5000);
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
