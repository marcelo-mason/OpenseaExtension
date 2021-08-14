const App = {}

App.extracted = []
App.extractionTabs = {}
App.runtimePort = null
App.running = false

/**
 * 
 * @param {*} tabId 
 */
function onTabRemoved(tabId) {
    let collections = Object.keys(App.extractionTabs)
    for (let i = 0; i < collections.length; i++) {
        const entry = App.extractionTabs[collections[i]]
        if (entry.tab.id === tabId) {
            delete App.extractionTabs[collections[i]]
            break
        }

    }
}

/**
 * 
 * @param {*} option 
 * @returns 
 */
async function constructUrl(option) {
    let query = {}
    query['extract-p'] = option.start_page || 0
    query['etract-r'] = 1
    query['extract-c'] = option.collection

    const encodeGetParams = p => Object.entries(p).map(kv => kv.map(encodeURIComponent).join("=")).join("&");
    return `https://rarity.tools/${option.collection}?${encodeGetParams(query)}`;

}

/**
 * 
 */
function sendExtractedResults() {
    const extracted = App.extracted.filter(x => x)
    chrome.tabs.query({}, function (tabs) {
        for (var i = 0; i < tabs.length; ++i) {
            chrome.tabs.sendMessage(
                tabs[i].id,
                {
                    messageFromZYX: true,
                    cmd: 'TOKENS',
                    extracted
                }
            );
        }
    });
}

/**
 * 
 * @param {Object} x 
 * @param {Object} entry 
 * @returns 
 */
function findIndex(x, entry) {
    if (!x) return false;
    if (entry.hasOwnProperty('extras') && x.hasOwnProperty('extras')) {
        return ((entry.extras.project_id === x.extras.project_id) && (x.tokenId === entry.tokenId))
    }
    if (x.collection != null && entry.collection != null) {
        return ((x.collection === entry.collection) && (x.tokenId === entry.tokenId))
    }
    return false
}

chrome.runtime.onConnect.addListener(function (port) {
    App.runtimePort = port;
    App.runtimePort.onMessage.addListener(function (message, details) {
        try {
            if (!message || !message.messageFromZYX == true) {
                return;
            }
            const sender = details.sender.tab
            switch (message.cmd) {
                case "TASK_STOPPED":
                    if (App.extractionTabs.hasOwnProperty(message.options.collection)) {
                        delete App.extractionTabs[message.options.collection]
                    }
                    break;
                case "TASK_COMPLETE":
                    chrome.tabs.remove(sender.id, function () { })
                    break;
                case 'TASK_RESULT':

                    for (let i = 0; i < message.results.length; i++) {
                        let entry = message.results[i],
                            index = App.extracted.findIndex(x => findIndex(x, entry));
                        if (index > -1) {
                            App.extracted = App.extracted.filter((_,i)=>i != index)
                        }
                        App.extracted.push(entry)
                    }
                    setLocalStorage("extracted", App.extracted);
                    sendExtractedResults()
                    break;
                case 'NEW_TASK':
                    sendExtractedResults()

                    if (App.extractionTabs.hasOwnProperty(message.options.collection)) {
                        return
                    }

                    App.extractionTabs[message.options.collection] = {
                        tab: sender,
                        busy: true,
                        tz: new Date()

                    }
                    if (!App.running) {
                        App.running = true;
                    }
                    break;
                case "ASSET_LOADED":
                    sendExtractedResults()
                    break;

                default:
                    break;
            }

        } catch (e) {
            console.error(e)
        }
    });
    App.runtimePort.onDisconnect.addListener(function () {
        App.runtimePort = null;
    });
});

chrome.tabs.onRemoved.addListener(onTabRemoved);

getLocalStorage('extracted').then(extracted => {
    if (extracted) App.extracted = extracted.filter(x => x);
})