// Launch Brave Search on toolbar icon click
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: 'https://search.brave.com' }))
