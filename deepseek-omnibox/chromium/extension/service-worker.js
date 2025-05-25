const deepseekChatURL = 'https://chat.deepseek.com'

// Launch DeepSeek Chat on toolbar icon click
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: deepseekChatURL }))

// Query DeepSeek on omnibox query submitted
chrome.omnibox.onInputEntered.addListener(query => {
    chrome.tabs.update({ url: deepseekChatURL }, async tab => {
        await new Promise(resolve => // after chat page finishes loading
            chrome.tabs.onUpdated.addListener(function loadedListener(tabId, info) {
                if (info.status == 'complete') {
                    chrome.tabs.onUpdated.removeListener(loadedListener) ; setTimeout(resolve, 500)
        }}))
        chrome.tabs.sendMessage(tab.id, query)
    })
})
