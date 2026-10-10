import { useState, useMemo } from 'react';
import { Search, X, Folder, Flag, Upload } from 'lucide-react';

export interface IconItem {
  name: string;
  className: string;
  category: 'regular' | 'solid' | 'brands';
}

export const iconLibraryData: IconItem[] = [
  // Font Awesome Regular
  { name: 'Address Book', className: 'far fa-address-book', category: 'regular' },
  { name: 'Address Card', className: 'far fa-address-card', category: 'regular' },
  { name: 'Angry', className: 'far fa-angry', category: 'regular' },
  { name: 'Arrow Alt Circle Down', className: 'far fa-arrow-alt-circle-down', category: 'regular' },
  { name: 'Arrow Alt Circle Left', className: 'far fa-arrow-alt-circle-left', category: 'regular' },
  { name: 'Arrow Alt Circle Right', className: 'far fa-arrow-alt-circle-right', category: 'regular' },
  { name: 'Arrow Alt Circle Up', className: 'far fa-arrow-alt-circle-up', category: 'regular' },
  { name: 'Bell', className: 'far fa-bell', category: 'regular' },
  { name: 'Bell Slash', className: 'far fa-bell-slash', category: 'regular' },
  { name: 'Bookmark', className: 'far fa-bookmark', category: 'regular' },
  { name: 'Building', className: 'far fa-building', category: 'regular' },
  { name: 'Calendar', className: 'far fa-calendar', category: 'regular' },
  { name: 'Calendar Alt', className: 'far fa-calendar-alt', category: 'regular' },
  { name: 'Calendar Check', className: 'far fa-calendar-check', category: 'regular' },
  { name: 'Calendar Minus', className: 'far fa-calendar-minus', category: 'regular' },
  { name: 'Calendar Plus', className: 'far fa-calendar-plus', category: 'regular' },
  { name: 'Calendar Times', className: 'far fa-calendar-times', category: 'regular' },
  { name: 'Caret Square Down', className: 'far fa-caret-square-down', category: 'regular' },
  { name: 'Caret Square Left', className: 'far fa-caret-square-left', category: 'regular' },
  { name: 'Caret Square Right', className: 'far fa-caret-square-right', category: 'regular' },
  { name: 'Caret Square Up', className: 'far fa-caret-square-up', category: 'regular' },
  { name: 'Chart Bar', className: 'far fa-chart-bar', category: 'regular' },
  { name: 'Check Circle', className: 'far fa-check-circle', category: 'regular' },
  { name: 'Check Square', className: 'far fa-check-square', category: 'regular' },
  { name: 'Circle', className: 'far fa-circle', category: 'regular' },
  { name: 'Clipboard', className: 'far fa-clipboard', category: 'regular' },
  { name: 'Clock', className: 'far fa-clock', category: 'regular' },
  { name: 'Clone', className: 'far fa-clone', category: 'regular' },
  { name: 'Closed Captioning', className: 'far fa-closed-captioning', category: 'regular' },
  { name: 'Comment', className: 'far fa-comment', category: 'regular' },
  { name: 'Comment Alt', className: 'far fa-comment-alt', category: 'regular' },
  { name: 'Comment Dots', className: 'far fa-comment-dots', category: 'regular' },
  { name: 'Comments', className: 'far fa-comments', category: 'regular' },
  { name: 'Compass', className: 'far fa-compass', category: 'regular' },
  { name: 'Copy', className: 'far fa-copy', category: 'regular' },
  { name: 'Credit Card', className: 'far fa-credit-card', category: 'regular' },
  { name: 'Dizzy', className: 'far fa-dizzy', category: 'regular' },
  { name: 'Dot Circle', className: 'far fa-dot-circle', category: 'regular' },
  { name: 'Edit', className: 'far fa-edit', category: 'regular' },
  { name: 'Envelope', className: 'far fa-envelope', category: 'regular' },
  { name: 'Envelope Open', className: 'far fa-envelope-open', category: 'regular' },
  { name: 'Eye', className: 'far fa-eye', category: 'regular' },
  { name: 'Eye Slash', className: 'far fa-eye-slash', category: 'regular' },
  { name: 'File', className: 'far fa-file', category: 'regular' },
  { name: 'File Alt', className: 'far fa-file-alt', category: 'regular' },
  { name: 'File Audio', className: 'far fa-file-audio', category: 'regular' },
  { name: 'File Code', className: 'far fa-file-code', category: 'regular' },
  { name: 'File Excel', className: 'far fa-file-excel', category: 'regular' },
  { name: 'File Image', className: 'far fa-file-image', category: 'regular' },
  { name: 'File Pdf', className: 'far fa-file-pdf', category: 'regular' },
  { name: 'File Video', className: 'far fa-file-video', category: 'regular' },
  { name: 'File Word', className: 'far fa-file-word', category: 'regular' },
  { name: 'Flag', className: 'far fa-flag', category: 'regular' },
  { name: 'Flushed', className: 'far fa-flushed', category: 'regular' },
  { name: 'Folder', className: 'far fa-folder', category: 'regular' },
  { name: 'Folder Open', className: 'far fa-folder-open', category: 'regular' },
  { name: 'Frown', className: 'far fa-frown', category: 'regular' },
  { name: 'Frown Open', className: 'far fa-frown-open', category: 'regular' },
  { name: 'Futbol', className: 'far fa-futbol', category: 'regular' },
  { name: 'Gem', className: 'far fa-gem', category: 'regular' },
  { name: 'Grimace', className: 'far fa-grimace', category: 'regular' },
  { name: 'Grin', className: 'far fa-grin', category: 'regular' },
  { name: 'Grin Alt', className: 'far fa-grin-alt', category: 'regular' },
  { name: 'Grin Beam', className: 'far fa-grin-beam', category: 'regular' },
  { name: 'Grin Beam Sweat', className: 'far fa-grin-beam-sweat', category: 'regular' },
  { name: 'Grin Hearts', className: 'far fa-grin-hearts', category: 'regular' },
  { name: 'Grin Squint', className: 'far fa-grin-squint', category: 'regular' },
  { name: 'Grin Squint Tears', className: 'far fa-grin-squint-tears', category: 'regular' },
  { name: 'Grin Stars', className: 'far fa-grin-stars', category: 'regular' },
  { name: 'Grin Tears', className: 'far fa-grin-tears', category: 'regular' },
  { name: 'Grin Tongue', className: 'far fa-grin-tongue', category: 'regular' },
  { name: 'Grin Wink', className: 'far fa-grin-wink', category: 'regular' },
  { name: 'Hand Paper', className: 'far fa-hand-paper', category: 'regular' },
  { name: 'Hand Point Down', className: 'far fa-hand-point-down', category: 'regular' },
  { name: 'Hand Point Left', className: 'far fa-hand-point-left', category: 'regular' },
  { name: 'Hand Point Right', className: 'far fa-hand-point-right', category: 'regular' },
  { name: 'Hand Point Up', className: 'far fa-hand-point-up', category: 'regular' },
  { name: 'Hand Rock', className: 'far fa-hand-rock', category: 'regular' },
  { name: 'Hand Scissors', className: 'far fa-hand-scissors', category: 'regular' },
  { name: 'Handshake', className: 'far fa-handshake', category: 'regular' },
  { name: 'HDD', className: 'far fa-hdd', category: 'regular' },
  { name: 'Heart', className: 'far fa-heart', category: 'regular' },
  { name: 'Hospital', className: 'far fa-hospital', category: 'regular' },
  { name: 'Hourglass', className: 'far fa-hourglass', category: 'regular' },
  { name: 'ID Badge', className: 'far fa-id-badge', category: 'regular' },
  { name: 'ID Card', className: 'far fa-id-card', category: 'regular' },
  { name: 'Image', className: 'far fa-image', category: 'regular' },
  { name: 'Images', className: 'far fa-images', category: 'regular' },
  { name: 'Keyboard', className: 'far fa-keyboard', category: 'regular' },
  { name: 'Lemon', className: 'far fa-lemon', category: 'regular' },
  { name: 'Life Ring', className: 'far fa-life-ring', category: 'regular' },
  { name: 'Lightbulb', className: 'far fa-lightbulb', category: 'regular' },
  { name: 'List Alt', className: 'far fa-list-alt', category: 'regular' },
  { name: 'Map', className: 'far fa-map', category: 'regular' },
  { name: 'ME', className: 'far fa-meh', category: 'regular' },
  { name: 'Meh Blank', className: 'far fa-meh-blank', category: 'regular' },
  { name: 'Meh Rolling Eyes', className: 'far fa-meh-rolling-eyes', category: 'regular' },
  { name: 'Minus Square', className: 'far fa-minus-square', category: 'regular' },
  { name: 'Money Bill Alt', className: 'far fa-money-bill-alt', category: 'regular' },
  { name: 'Moon', className: 'far fa-moon', category: 'regular' },
  { name: 'Newspaper', className: 'far fa-newspaper', category: 'regular' },
  { name: 'Object Group', className: 'far fa-object-group', category: 'regular' },
  { name: 'Object Ungroup', className: 'far fa-object-ungroup', category: 'regular' },
  { name: 'Paper Plane', className: 'far fa-paper-plane', category: 'regular' },
  { name: 'Pause Circle', className: 'far fa-pause-circle', category: 'regular' },
  { name: 'Play Circle', className: 'far fa-play-circle', category: 'regular' },
  { name: 'Plus Square', className: 'far fa-plus-square', category: 'regular' },
  { name: 'Question Circle', className: 'far fa-question-circle', category: 'regular' },
  { name: 'Registered', className: 'far fa-registered', category: 'regular' },
  { name: 'Sad Cry', className: 'far fa-sad-cry', category: 'regular' },
  { name: 'Sad Tear', className: 'far fa-sad-tear', category: 'regular' },
  { name: 'Save', className: 'far fa-save', category: 'regular' },
  { name: 'Share Square', className: 'far fa-share-square', category: 'regular' },
  { name: 'Smile', className: 'far fa-smile', category: 'regular' },
  { name: 'Smile Beam', className: 'far fa-smile-beam', category: 'regular' },
  { name: 'Smile Wink', className: 'far fa-smile-wink', category: 'regular' },
  { name: 'Snowflake', className: 'far fa-snowflake', category: 'regular' },
  { name: 'Square', className: 'far fa-square', category: 'regular' },
  { name: 'Star', className: 'far fa-star', category: 'regular' },
  { name: 'Star Half', className: 'far fa-star-half', category: 'regular' },
  { name: 'Sticky Note', className: 'far fa-sticky-note', category: 'regular' },
  { name: 'Stop Circle', className: 'far fa-stop-circle', category: 'regular' },
  { name: 'Sun', className: 'far fa-sun', category: 'regular' },
  { name: 'Surprise', className: 'far fa-surprise', category: 'regular' },
  { name: 'Thumbs Down', className: 'far fa-thumbs-down', category: 'regular' },
  { name: 'Thumbs Up', className: 'far fa-thumbs-up', category: 'regular' },
  { name: 'Times Circle', className: 'far fa-times-circle', category: 'regular' },
  { name: 'Tired', className: 'far fa-tired', category: 'regular' },
  { name: 'Trash Alt', className: 'far fa-trash-alt', category: 'regular' },
  { name: 'User', className: 'far fa-user', category: 'regular' },
  { name: 'User Circle', className: 'far fa-user-circle', category: 'regular' },
  { name: 'Window Close', className: 'far fa-window-close', category: 'regular' },
  { name: 'Window Maximize', className: 'far fa-window-maximize', category: 'regular' },
  { name: 'Window Minimize', className: 'far fa-window-minimize', category: 'regular' },
  { name: 'Window Restore', className: 'far fa-window-restore', category: 'regular' },

  // Font Awesome Solid
  { name: 'Ad', className: 'fas fa-ad', category: 'solid' },
  { name: 'Address Book', className: 'fas fa-address-book', category: 'solid' },
  { name: 'Address Card', className: 'fas fa-address-card', category: 'solid' },
  { name: 'Adjust', className: 'fas fa-adjust', category: 'solid' },
  { name: 'Air Freshener', className: 'fas fa-air-freshener', category: 'solid' },
  { name: 'Align Center', className: 'fas fa-align-center', category: 'solid' },
  { name: 'Align Justify', className: 'fas fa-align-justify', category: 'solid' },
  { name: 'Align Left', className: 'fas fa-align-left', category: 'solid' },
  { name: 'Align Right', className: 'fas fa-align-right', category: 'solid' },
  { name: 'Allergies', className: 'fas fa-allergies', category: 'solid' },
  { name: 'Ambulance', className: 'fas fa-ambulance', category: 'solid' },
  { name: 'Anchor', className: 'fas fa-anchor', category: 'solid' },
  { name: 'Angle Down', className: 'fas fa-angle-down', category: 'solid' },
  { name: 'Angle Left', className: 'fas fa-angle-left', category: 'solid' },
  { name: 'Angle Right', className: 'fas fa-angle-right', category: 'solid' },
  { name: 'Angle Up', className: 'fas fa-angle-up', category: 'solid' },
  { name: 'Angle Double Down', className: 'fas fa-angle-double-down', category: 'solid' },
  { name: 'Angle Double Left', className: 'fas fa-angle-double-left', category: 'solid' },
  { name: 'Angle Double Right', className: 'fas fa-angle-double-right', category: 'solid' },
  { name: 'Angle Double Up', className: 'fas fa-angle-double-up', category: 'solid' },
  { name: 'Archive', className: 'fas fa-archive', category: 'solid' },
  { name: 'Arrow Down', className: 'fas fa-arrow-down', category: 'solid' },
  { name: 'Arrow Left', className: 'fas fa-arrow-left', category: 'solid' },
  { name: 'Arrow Right', className: 'fas fa-arrow-right', category: 'solid' },
  { name: 'Arrow Up', className: 'fas fa-arrow-up', category: 'solid' },
  { name: 'Arrows Alt', className: 'fas fa-arrows-alt', category: 'solid' },
  { name: 'Award', className: 'fas fa-award', category: 'solid' },
  { name: 'Baby', className: 'fas fa-baby', category: 'solid' },
  { name: 'Backspace', className: 'fas fa-backspace', category: 'solid' },
  { name: 'Bag Shopping', className: 'fas fa-shopping-bag', category: 'solid' },
  { name: 'Ban', className: 'fas fa-ban', category: 'solid' },
  { name: 'Barcode', className: 'fas fa-barcode', category: 'solid' },
  { name: 'Bars', className: 'fas fa-bars', category: 'solid' },
  { name: 'Battery Full', className: 'fas fa-battery-full', category: 'solid' },
  { name: 'Bell', className: 'fas fa-bell', category: 'solid' },
  { name: 'Bolt', className: 'fas fa-bolt', category: 'solid' },
  { name: 'Book', className: 'fas fa-book', category: 'solid' },
  { name: 'Bookmark', className: 'fas fa-bookmark', category: 'solid' },
  { name: 'Box', className: 'fas fa-box', category: 'solid' },
  { name: 'Boxes', className: 'fas fa-boxes', category: 'solid' },
  { name: 'Briefcase', className: 'fas fa-briefcase', category: 'solid' },
  { name: 'Bullhorn', className: 'fas fa-bullhorn', category: 'solid' },
  { name: 'Calculator', className: 'fas fa-calculator', category: 'solid' },
  { name: 'Calendar', className: 'fas fa-calendar', category: 'solid' },
  { name: 'Camera', className: 'fas fa-camera', category: 'solid' },
  { name: 'Cart Plus', className: 'fas fa-cart-plus', category: 'solid' },
  { name: 'Certificate', className: 'fas fa-certificate', category: 'solid' },
  { name: 'Chart Line', className: 'fas fa-chart-line', category: 'solid' },
  { name: 'Chart Pie', className: 'fas fa-chart-pie', category: 'solid' },
  { name: 'Check', className: 'fas fa-check', category: 'solid' },
  { name: 'Check Circle', className: 'fas fa-check-circle', category: 'solid' },
  { name: 'Check Double', className: 'fas fa-check-double', category: 'solid' },
  { name: 'Chevron Down', className: 'fas fa-chevron-down', category: 'solid' },
  { name: 'Chevron Left', className: 'fas fa-chevron-left', category: 'solid' },
  { name: 'Chevron Right', className: 'fas fa-chevron-right', category: 'solid' },
  { name: 'Chevron Up', className: 'fas fa-chevron-up', category: 'solid' },
  { name: 'Clock', className: 'fas fa-clock', category: 'solid' },
  { name: 'Cog', className: 'fas fa-cog', category: 'solid' },
  { name: 'Cogs', className: 'fas fa-cogs', category: 'solid' },
  { name: 'Comment', className: 'fas fa-comment', category: 'solid' },
  { name: 'Comments', className: 'fas fa-comments', category: 'solid' },
  { name: 'Credit Card', className: 'fas fa-credit-card', category: 'solid' },
  { name: 'Crown', className: 'fas fa-crown', category: 'solid' },
  { name: 'Database', className: 'fas fa-database', category: 'solid' },
  { name: 'Dollar Sign', className: 'fas fa-dollar-sign', category: 'solid' },
  { name: 'Download', className: 'fas fa-download', category: 'solid' },
  { name: 'Envelope', className: 'fas fa-envelope', category: 'solid' },
  { name: 'Exclamation', className: 'fas fa-exclamation', category: 'solid' },
  { name: 'Exclamation Circle', className: 'fas fa-exclamation-circle', category: 'solid' },
  { name: 'Exclamation Triangle', className: 'fas fa-exclamation-triangle', category: 'solid' },
  { name: 'Eye', className: 'fas fa-eye', category: 'solid' },
  { name: 'File', className: 'fas fa-file', category: 'solid' },
  { name: 'Filter', className: 'fas fa-filter', category: 'solid' },
  { name: 'Fire', className: 'fas fa-fire', category: 'solid' },
  { name: 'Folder', className: 'fas fa-folder', category: 'solid' },
  { name: 'Gift', className: 'fas fa-gift', category: 'solid' },
  { name: 'Globe', className: 'fas fa-globe', category: 'solid' },
  { name: 'Hand Holding Heart', className: 'fas fa-hand-holding-heart', category: 'solid' },
  { name: 'Headphones', className: 'fas fa-headphones', category: 'solid' },
  { name: 'Heart', className: 'fas fa-heart', category: 'solid' },
  { name: 'Home', className: 'fas fa-home', category: 'solid' },
  { name: 'Image', className: 'fas fa-image', category: 'solid' },
  { name: 'Info', className: 'fas fa-info', category: 'solid' },
  { name: 'Info Circle', className: 'fas fa-info-circle', category: 'solid' },
  { name: 'Key', className: 'fas fa-key', category: 'solid' },
  { name: 'Laptop', className: 'fas fa-laptop', category: 'solid' },
  { name: 'Layer Group', className: 'fas fa-layer-group', category: 'solid' },
  { name: 'Lightbulb', className: 'fas fa-lightbulb', category: 'solid' },
  { name: 'Link', className: 'fas fa-link', category: 'solid' },
  { name: 'List', className: 'fas fa-list', category: 'solid' },
  { name: 'Location Arrow', className: 'fas fa-location-arrow', category: 'solid' },
  { name: 'Lock', className: 'fas fa-lock', category: 'solid' },
  { name: 'Map Marker Alt', className: 'fas fa-map-marker-alt', category: 'solid' },
  { name: 'Medal', className: 'fas fa-medal', category: 'solid' },
  { name: 'Money Bill', className: 'fas fa-money-bill', category: 'solid' },
  { name: 'Moon', className: 'fas fa-moon', category: 'solid' },
  { name: 'Music', className: 'fas fa-music', category: 'solid' },
  { name: 'Paint Brush', className: 'fas fa-paint-brush', category: 'solid' },
  { name: 'Paper Plane', className: 'fas fa-paper-plane', category: 'solid' },
  { name: 'Percent', className: 'fas fa-percent', category: 'solid' },
  { name: 'Phone', className: 'fas fa-phone', category: 'solid' },
  { name: 'Phone Alt', className: 'fas fa-phone-alt', category: 'solid' },
  { name: 'Play', className: 'fas fa-play', category: 'solid' },
  { name: 'Plus', className: 'fas fa-plus', category: 'solid' },
  { name: 'Question', className: 'fas fa-question', category: 'solid' },
  { name: 'Question Circle', className: 'fas fa-question-circle', category: 'solid' },
  { name: 'Receipt', className: 'fas fa-receipt', category: 'solid' },
  { name: 'Redo', className: 'fas fa-redo', category: 'solid' },
  { name: 'Rocket', className: 'fas fa-rocket', category: 'solid' },
  { name: 'Save', className: 'fas fa-save', category: 'solid' },
  { name: 'Search', className: 'fas fa-search', category: 'solid' },
  { name: 'Share', className: 'fas fa-share', category: 'solid' },
  { name: 'Share Alt', className: 'fas fa-share-alt', category: 'solid' },
  { name: 'Shield Alt', className: 'fas fa-shield-alt', category: 'solid' },
  { name: 'Shopping Bag', className: 'fas fa-shopping-bag', category: 'solid' },
  { name: 'Shopping Cart', className: 'fas fa-shopping-cart', category: 'solid' },
  { name: 'Star', className: 'fas fa-star', category: 'solid' },
  { name: 'Star Half Alt', className: 'fas fa-star-half-alt', category: 'solid' },
  { name: 'Store', className: 'fas fa-store', category: 'solid' },
  { name: 'Sync', className: 'fas fa-sync', category: 'solid' },
  { name: 'Tag', className: 'fas fa-tag', category: 'solid' },
  { name: 'Tags', className: 'fas fa-tags', category: 'solid' },
  { name: 'Thumbs Up', className: 'fas fa-thumbs-up', category: 'solid' },
  { name: 'Times', className: 'fas fa-times', category: 'solid' },
  { name: 'Trash', className: 'fas fa-trash', category: 'solid' },
  { name: 'Trophy', className: 'fas fa-trophy', category: 'solid' },
  { name: 'Truck', className: 'fas fa-truck', category: 'solid' },
  { name: 'Undo', className: 'fas fa-undo', category: 'solid' },
  { name: 'Unlock', className: 'fas fa-unlock', category: 'solid' },
  { name: 'User', className: 'fas fa-user', category: 'solid' },
  { name: 'User Check', className: 'fas fa-user-check', category: 'solid' },
  { name: 'User Plus', className: 'fas fa-user-plus', category: 'solid' },
  { name: 'Users', className: 'fas fa-users', category: 'solid' },
  { name: 'Utensils', className: 'fas fa-utensils', category: 'solid' },
  { name: 'Video', className: 'fas fa-video', category: 'solid' },
  { name: 'Wallet', className: 'fas fa-wallet', category: 'solid' },

  // Font Awesome Brands
  { name: 'Amazon', className: 'fab fa-amazon', category: 'brands' },
  { name: 'Apple', className: 'fab fa-apple', category: 'brands' },
  { name: 'App Store', className: 'fab fa-app-store', category: 'brands' },
  { name: 'Bootstrap', className: 'fab fa-bootstrap', category: 'brands' },
  { name: 'Chrome', className: 'fab fa-chrome', category: 'brands' },
  { name: 'CSS3', className: 'fab fa-css3-alt', category: 'brands' },
  { name: 'Discord', className: 'fab fa-discord', category: 'brands' },
  { name: 'Facebook', className: 'fab fa-facebook', category: 'brands' },
  { name: 'Facebook F', className: 'fab fa-facebook-f', category: 'brands' },
  { name: 'Facebook Messenger', className: 'fab fa-facebook-messenger', category: 'brands' },
  { name: 'GitHub', className: 'fab fa-github', category: 'brands' },
  { name: 'Google', className: 'fab fa-google', category: 'brands' },
  { name: 'Google Play', className: 'fab fa-google-play', category: 'brands' },
  { name: 'HTML5', className: 'fab fa-html5', category: 'brands' },
  { name: 'Instagram', className: 'fab fa-instagram', category: 'brands' },
  { name: 'JavaScript', className: 'fab fa-js', category: 'brands' },
  { name: 'LinkedIn', className: 'fab fa-linkedin', category: 'brands' },
  { name: 'LinkedIn In', className: 'fab fa-linkedin-in', category: 'brands' },
  { name: 'Medium', className: 'fab fa-medium', category: 'brands' },
  { name: 'Pinterest', className: 'fab fa-pinterest', category: 'brands' },
  { name: 'React', className: 'fab fa-react', category: 'brands' },
  { name: 'Reddit', className: 'fab fa-reddit', category: 'brands' },
  { name: 'Shopify', className: 'fab fa-shopify', category: 'brands' },
  { name: 'Skype', className: 'fab fa-skype', category: 'brands' },
  { name: 'Snapchat', className: 'fab fa-snapchat', category: 'brands' },
  { name: 'Spotify', className: 'fab fa-spotify', category: 'brands' },
  { name: 'Telegram', className: 'fab fa-telegram', category: 'brands' },
  { name: 'TikTok', className: 'fab fa-tiktok', category: 'brands' },
  { name: 'Twitter', className: 'fab fa-twitter', category: 'brands' },
  { name: 'Viber', className: 'fab fa-viber', category: 'brands' },
  { name: 'Vimeo', className: 'fab fa-vimeo-v', category: 'brands' },
  { name: 'WhatsApp', className: 'fab fa-whatsapp', category: 'brands' },
  { name: 'WordPress', className: 'fab fa-wordpress', category: 'brands' },
  { name: 'X Twitter', className: 'fab fa-x-twitter', category: 'brands' },
  { name: 'YouTube', className: 'fab fa-youtube', category: 'brands' }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconClass: string) => void;
  currentIcon?: string;
}

export function IconLibraryModal({ isOpen, onClose, onSelect, currentIcon }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'regular' | 'solid' | 'brands'>('all');
  const [search, setSearch] = useState('');
  const [activeIcon, setActiveIcon] = useState<string>(currentIcon || 'fas fa-star');

  const filteredIcons = useMemo(() => {
    return iconLibraryData.filter(icon => {
      const matchCategory = selectedCategory === 'all' || icon.category === selectedCategory;
      const matchSearch = search.trim() === '' || icon.name.toLowerCase().includes(search.toLowerCase()) || icon.className.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, search]);

  if (!isOpen) return null;

  return (
    <div className="elementor-icon-modal-overlay" onClick={onClose}>
      <div className="elementor-icon-modal-dialog" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="elementor-icon-modal-header">
          <div className="elementor-icon-modal-title">
            <span className="elementor-modal-mark">E</span>
            <strong>ICON LIBRARY</strong>
          </div>
          <button className="elementor-icon-modal-close" onClick={onClose} title="Close Icon Library">
            <X size={18} />
          </button>
        </div>

        {/* Modal Main Content (Sidebar + Grid) */}
        <div className="elementor-icon-modal-main">
          {/* Left Navigation Sidebar */}
          <aside className="elementor-icon-modal-sidebar">
            <button
              className={`elementor-icon-category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              <i className="eicon-apps" />
              <span>All Icons</span>
            </button>
            <button
              className={`elementor-icon-category-btn ${selectedCategory === 'regular' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('regular')}
            >
              <Folder size={16} />
              <span>Font Awesome - Regular</span>
            </button>
            <button
              className={`elementor-icon-category-btn ${selectedCategory === 'solid' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('solid')}
            >
              <Flag size={16} />
              <span>Font Awesome - Solid</span>
            </button>
            <button
              className={`elementor-icon-category-btn ${selectedCategory === 'brands' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('brands')}
            >
              <i className="fab fa-font-awesome-flag" />
              <span>Font Awesome - Brands</span>
            </button>

            <div className="elementor-icon-modal-sidebar-footer">
              <span className="elementor-sidebar-footer-title">My Libraries</span>
              <button className="elementor-icon-upload-btn" onClick={() => alert('Custom SVG upload: Select an SVG file to embed.')}>
                <Upload size={14} />
                <span>Upload SVG</span>
              </button>
            </div>
          </aside>

          {/* Right Main Grid */}
          <section className="elementor-icon-modal-body">
            <div className="elementor-icon-modal-search-row">
              <div className="elementor-icon-search-box">
                <Search size={15} />
                <input
                  placeholder="Filter by name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="elementor-icon-section-title">
              <h3>{selectedCategory === 'all' ? 'All Icons' : selectedCategory === 'regular' ? 'Font Awesome - Regular' : selectedCategory === 'solid' ? 'Font Awesome - Solid' : 'Font Awesome - Brands'}</h3>
              <span>{filteredIcons.length} icons</span>
            </div>

            <div className="elementor-icon-grid-scroll">
              <div className="elementor-icon-grid">
                {filteredIcons.map(icon => {
                  const isSelected = activeIcon === icon.className;
                  return (
                    <div
                      key={`${icon.category}-${icon.className}`}
                      className={`elementor-icon-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setActiveIcon(icon.className)}
                      onDoubleClick={() => {
                        onSelect(icon.className);
                        onClose();
                      }}
                    >
                      <i className={icon.className} />
                      <span className="elementor-icon-card-name" title={icon.name}>
                        {icon.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="elementor-icon-modal-footer">
          <div className="elementor-modal-footer-left">
            {activeIcon && (
              <span className="elementor-selected-icon-preview">
                Selected: <i className={activeIcon} /> <code>{activeIcon}</code>
              </span>
            )}
          </div>
          <button
            className="elementor-icon-insert-btn"
            disabled={!activeIcon}
            onClick={() => {
              if (activeIcon) onSelect(activeIcon);
              onClose();
            }}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
