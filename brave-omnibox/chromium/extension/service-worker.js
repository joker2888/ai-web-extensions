const braveSearchURL = 'https://search.brave.com'

// Launch Brave Search on toolbar icon click
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: braveSearchURL }))

// Query Brave AI on omnibox query submitted
chrome.omnibox.onInputEntered.addListener(query =>
    chrome.tabs.update({ url: `${braveSearchURL}/search?q=${decodeURIComponent(query)}&summary=1` }))
