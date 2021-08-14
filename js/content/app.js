var agent = {
    port: null,
    hasNoError: false,
    msgSent: 0,
    send: function (msg, successHandler) {
        try {
            if (!agent.hasNoError) {
                agent.port = chrome.runtime.connect();
                agent.port.onMessage.addListener(function (responseFromWinExtension) {
                    var lastError = chrome.runtime.lastError;
                    if (lastError) {
                        console.warn(lastError);
                        agent.hasNoError = false;
                        return;
                    }
                    agent.hasNoError = true;
                    successHandler && successHandler(responseFromWinExtension);
                });
            }
            agent.msgSent++;
            if (agent.msgSent > 10) {
                agent.hasNoError = false;
                agent.msgSent = 0;
            }
            agent.port.postMessage(msg);
        } catch (error) {
            console.warn(error.message);
            agent.hasNoError = false;
        }
    },
}

var parsedCollections = [],
    assetCollections = {},
    parsingState = 0



/**
 * 
 */
async function afterWindowLoaded() {
    let location = new URL(window.location)
    let current_path = location.pathname.split('/').filter(x => x.length)

    switch (location.hostname) {
        case "opensea.io":
            if (current_path.length == 2 && ["assets", 'collection'].includes(current_path[0])) {
                parsedCollections = [current_path[1]]
                registerAssetDetection()
                postMessageToExtension({
                    cmd: "ASSET_LOADED"
                })
                break;
            }
            if (current_path.length == 1 && ["assets", 'collection'].includes(current_path[0])) {
                registerAssetDetection()
                postMessageToExtension({
                    cmd: "ASSET_LOADED"
                })
                break;
            }
            if (current_path[0] === "accounts") {
                registerAssetDetection()
                postMessageToExtension({
                    cmd: "ASSET_LOADED"
                })
                break;
            }
            break;
        case "rarity.tools":
            assetCollections = await loadCollections()
            if (current_path.length === 1 && isCollectionPage(current_path[0])) {
                showExtractionBtn(current_path[0])
            }
        case "rarity.guide":
            if (current_path.pop() === "ranking") {
                showExtractionBtnRank(current_path[0])
            }
            break;

        default:
            break;
    }
}


/**
 *
 * @param {*} request
 * @param {*} sender
 * @param {*} sendResponse
 */
function receiveRT_MessageFromExtension(request, sender, sendResponse) {
    sendResponse && sendResponse({ received: true });
    if (!request.messageFromZYX) return;
    switch (request.cmd) {
        case "TOKENS":
            updateAssets(request.extracted)
        default:
            break;
    }
}


/**
 *
 * @param {*} message
 * @param {*} callback
 */
function postMessageToExtension(message, callback = null) {
    message.messageFromZYX = true;
    message.location = window.location.href;
    agent.send(message, callback);
}

async function loadCollections() {
    let response = await fetch("https://collections.rarity.tools/static/collections.json", {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "sec-ch-ua": "\"Chromium\";v=\"92\", \" Not A;Brand\";v=\"99\", \"Google Chrome\";v=\"92\"",
            "sec-ch-ua-mobile": "?0"
        },
        "referrer": "https://rarity.tools/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "omit"
    })
    response = await response.json()
    return response
}

/**
 * 
 * @param {String} collection 
 * @returns 
 */
function isCollectionPage(collection) {
    return assetCollections.collections.map(x => x.id).includes(collection.trim())
}

/**
 * 
 * @param {String} string 
 * @returns {HTMLElement}
 */
function createHTML(string) {
    var e = document.createElement('div'), r = document.createRange();
    r.selectNodeContents(e)
    var f = r.createContextualFragment(string);
    e.appendChild(f);
    return e.firstElementChild
}
/**
 * 
 * @param {*} collection 
 */
async function showExtractionBtn(collection) {

    let el = `<div class="text-sm" style="padding-left: 60em">
            <div class="flex flex-row flex-wrap">
                <div class="mr-1">
                    <a  target="_blank" state="0" id="parse_collection" title="Click to parse ${collection}" href="https://rarity.tools/?extract=1&extract-c=${collection}" class="bigBtn">
                        PARSE COLLECTION
                    </a>
                </div>
            </div>
        </div>`, row = null;

    while (row == null) {
        await sleep(1000)
        row = document.querySelector("#__layout > div > div.flex-1.overflow-hidden.lg\\:flex.lg\\:flex-row.bg > div.bg.max-h-full.px-0\\.5.lg\\:px-2.text-lg.textColor600.bg-white.lg\\:overflow-y-scroll.lg\\:flex-grow.scrollColor > div.pt-2.px-9 > div.flex.flex-row.flex-wrap")

    }

    let btnEl = createHTML(el)

    btnEl.querySelector("#parse_collection").addEventListener("click", function (event) {
        event.preventDefault()

        let options = { collection }
        let state = this.getAttribute("state")
        if (state === "0") {
            postMessageToExtension({ cmd: 'NEW_TASK', options })
            this.title = `Parsing collection: ${collection}...`
            this.innerText = "CANCEL PARSING"
            this.setAttribute("state", "1")
            parsingState = 1
            rairity_extract_assets(options)
        } else {
            postMessageToExtension({ cmd: 'TASK_STOPPED', options },)
            this.title = `Click to parse ${collection}`
            this.innerText = "PARSE COLLECTION"
            this.setAttribute("state", "0")
            parsingState = 0
        }


    })

    return row.appendChild(btnEl)

}

/**
 * 
 */
async function showExtractionBtnRank() {
    const btn = document.createElement("button")
    const div = document.querySelector("body > section:nth-child(3) > div")
    btn.innerText = "Parse Rarity"
    btn.classList.add("button", "is-info")

    btn.addEventListener("click", function () {
        guide_extract_assets().then(x => {
            btn.innerText = "Project Parsed"
        })

        btn.innerText = "Parsing..."

    })

    div.prepend(btn)

}

/**
 * 
 * @param {Object} entry
 * @param {String} tokenId 
 * @param {String} collection 
 * @param {String} project_name 
 * 
 * @returns {Boolean}
 */
function findDetail(entry, tokenId, collection, project_name) {
    if (entry.hasOwnProperty('extras') && project_name) {
        return (
            (entry.tokenId === tokenId) &&
            collection.startsWith(entry.collection_prefix) &&
            (entry.extras.project_name.toLocaleLowerCase().trim() === project_name.toLocaleLowerCase().trim())
        );
    }
    return (entry.tokenId === tokenId && entry.collection === collection)
}
/**
 * 
 * @param {Array<Object>} details 
 */
async function updateAssets(details) {

    const assets = getAssets();
    assets.forEach(asset => {
        let { tokenId, project_name } = getAssetTokenId(asset)
        let collection = getAssetCollection(asset)

        if (!tokenId || !collection) return;

        let info = details.find(x => findDetail(x, tokenId, collection, project_name))
        if (info) {
            const node = asset.getElementsByClassName('AssetCardFooter--collection')[0].parentElement
            const rank = document.createElement('div')

            rank.innerText = info.rank
            rank.classList.add("AssetCardFooter--name")
            rank.style.cssText = "font-size: 16px; color: red;"

            rank.setAttribute('id', "rank")
            x = node.querySelector('#rank')
            if (!x) node.appendChild(rank);
        }
    });
}

/**
 * 
 * @returns {Array<HTMLElement>}
 */
function getAssets() {
    const assets = Array.from(
        document.querySelectorAll('.Asset--loaded')
    )
    return assets
}

/**
  * @param {String} assetNode
 */
function getAssetCollection(assetNode) {
    let l = new URL(window.location)
    let p = l.pathname.split('/')
    if (l.hostname === "opensea.io" && p.length == 3 & ["assets", 'collection'].includes(p[1])) {
        parsedCollections = [p[2]]
    }

    let collection = assetNode.getElementsByClassName('AssetCardFooter--collection')
    collection = collection.length ? collection[0].innerText.replaceAll(' ', '-').toLocaleLowerCase() : ''
    if (parsedCollections.includes(collection)) { return collection }
    else {
        for (let i = 0; i < parsedCollections.length; i++) {
            const x = parsedCollections[i];
            if (collection.includes(x)) return x;
        }
    }

    if (parsedCollections.length == 1) return parsedCollections[0];
    return collection
}

/**
  * @param {Element} assetNode
 */
function getAssetTokenId(assetNode) {
    let tokenId, project_name;

    let infoNode = assetNode.getElementsByClassName('AssetCardFooter--name')
    let info = infoNode.length ? infoNode[0].innerText : ''

    let parts = info.split(" ")
    if (parts.length > 1) {
        tokenId = parts.pop()
        if (tokenId.startsWith("#")) tokenId = tokenId.split("#")[1];
        project_name = parts.join(" ")
    } else {
        tokenId = parts[0]
    }

    return { tokenId, project_name }
}


/**
 * 
 * @returns 
 */
function registerAssetDetection() {
    document.arrive('.Asset--loaded', function () {
        postMessageToExtension({
            cmd: "ASSET_LOADED"
        })
    });
}


/**
 * 
 * @returns 
 */
async function getAssetPaginator() {
    let wait = 0, pageIndicator = null, totalPage = 0, nextSelector = null;
    // Ensure the page is fully loaded
    while (!pageIndicator) {
        if (wait / 1000 == 60) {
            return {
                pageIndicator,
                totalPage,
                nextSelector
            }
        }
        await sleep(1000)
        pageIndicator = document.querySelector('input[placeholder="Page.."]')
        wait += 1000

    }

    totalPage = pageIndicator.parentElement.innerText.split(" ").pop()
    nextSelector = pageIndicator.parentElement.nextElementSibling
    return {
        pageIndicator,
        totalPage,
        nextSelector
    }

}

async function guide_extract_assets(options) {
    // take first table
    let table = null;
    while (table == null) {
        await sleep(1000)
        table = document.querySelector('table')
    }

    // Extract headers
    const headers = Array.from(table.querySelectorAll('thead>tr')).map(
        x => {
            return Array.from(x.querySelectorAll('th')).map(x => x.innerText)
        }
    )[0]

    // Extract project details 
    const info = document.querySelector("body > section:nth-child(2) > div > nav > ul > li:nth-child(2) > a")
    const infoDetails = {
        project_id: info.href.split("/").pop(),
        project_name: info.innerText.trim()
    }


    // Extract rows
    let rows = Array.from(table.querySelectorAll('tbody>tr')).map(x => {
        return Array.from(x.querySelectorAll('td')).map((x, i) => {
            if (i == 3) {
                let link = x.querySelector('a').href
                link = new URL(link)
                return {
                    tokenId: link.pathname.split("/").pop()
                }
            }
            return x.innerText.trim()
        })
    })
    rows = rows.map((row) => {
        var c = {};
        for (let i = 0; i < headers.length; i++) {
            c[headers[i]] = row[i];
        }
        Object.assign(c, { 'extras': infoDetails })
        return c;
    }).map(x => {
        return {
            extras: x.extras,
            rarity: x.Rarity,
            rank: x.Rank,
            tokenId: x.id,
            collection_prefix: "art-blocks",
            collection: null
        }
    })
    postMessageToExtension({
        cmd: "TASK_RESULT",
        results: rows
    })

}

/**
 * 
 * @param {Object} options 
 * @returns 
 */
async function rairity_extract_assets(options) {
    const assetLinkSelector = "#__layout > div > div.flex-1.overflow-hidden.lg\\:flex.lg\\:flex-row.bg > div.bg.max-h-full.px-0\\.5.lg\\:px-2.text-lg.textColor600.bg-white.lg\\:overflow-y-scroll.lg\\:flex-grow.scrollColor > div.flex.flex-row.items-start.justify-between > div.flex.flex-row.flex-wrap.justify-start.px-1.py-2.pt-1.ml-4.lg\\:px-2 > div"

    let { pageIndicator, totalPage, nextSelector } = await getAssetPaginator()
    if (!pageIndicator) return;

    do {
        const assets = document.querySelectorAll(assetLinkSelector)
        if (!assets.length) break;
        let payload = []
        for (let i = 0; i < assets.length; i++) {

            const asset = assets[i];
            let rarity = ""
            let rank = asset.querySelector(".font-extrabold")
            if (rank) {
                rank = rank.innerText.split(" ").pop()
            }
            let tokenId = asset.querySelector('a[href*="opensea.io/assets/"]')
            if (tokenId) {
                tokenId = tokenId.innerText.split(" ").pop()
                tokenId = tokenId.substr(1)
            }
            if (!rank || !tokenId) continue;
            payload.push({
                rarity,
                rank,
                tokenId,
                collection: options.collection
            })
        }
        if (payload.length) {
            postMessageToExtension({
                cmd: "TASK_RESULT",
                results: payload
            })
        }
        nextSelector.click()
        await sleep(250)

    } while (!(parseInt(pageIndicator.value) == parseInt(totalPage)) && parsingState == 1);
    document.querySelector("#parse_collection").innerText = "PARSE COLLECTION"

}
