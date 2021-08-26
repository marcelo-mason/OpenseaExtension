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
    assetCollections = {
        collections: [],
        projects: {
            list: [],
            lookup: {}
        }
    },
    parsingState = 0,
    assets = [];


/**
 * 
 */
async function afterWindowLoaded() {
    let location = new URL(window.location)
    let current_path = location.pathname.split('/').filter(x => x.length)

    switch (location.hostname) {
        case "opensea.io":
            // Due to CORS Blocking retrieve collections  from storage
            assetCollections = await getLocalStorage("collections", assetCollections)
            postMessageToExtension({ cmd: "ASSET_LOADED" })
            registerAssetDetection()

            // If is this is a collection listing page insert button to rarity.tools
            if (
                current_path.length == 2 &&
                current_path[0] === "collection" &&
                isCollection(current_path[1])

            ) {
                showOpenRarityBtn(current_path[1])
            }
            break;
        case "rarity.tools":
            // Load and update collections
            assetCollections = await loadCollections()
            if (current_path.length === 1 && isCollection(current_path[0])) {
                showExtractionBtn(current_path[0])
                break;
            }
            break;
        case "rarity.guide":
            if (current_path.length == 0) {
                showExtractionBtnRequests()
                break;
            }
            if (current_path.pop() === "ranking") {
                showExtractionBtnRank(current_path[0])
            }
            break;
        case "app.ai42.art":
            showExtractionBtnAI42()
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
async function receiveRT_MessageFromExtension(request, sender, sendResponse) {
    sendResponse && sendResponse({ received: true });
    if (!request.messageFromZYX) return;
    switch (request.cmd) {
        case "TOKENS":
            debug(`Recieved Asset payload. Asset count: ${request.extracted.length}`)
            assets = request.extracted;
            updateAssets()
            break;
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

/**
 * 
 * @param {String} collection 
 */
async function showOpenRarityBtn(collection) {
    let infoDiv = null
    while (infoDiv == null) {
        await sleep(1000)
        infoDiv = document.querySelector('div[class*="InfoContainerreact__InfoContainer"]')
    }
    const template = infoDiv.querySelector('div').cloneNode(1)

    template.querySelector('div[font-size="14px"]').innerText = ''
    template.querySelector('h3').innerText = "Open on rarity"
    const a = template.querySelector('a')
    a.href = `https://rarity.tools/${collection}`
    a.setAttribute('target', '_blank')

    infoDiv.appendChild(template)

}

/**
 * 
 * @param {String} collection 
 * @returns 
 */
function isCollection(collection) {
    return assetCollections.projects.list.includes(collection.trim())
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
        guide_extract_assets(document).then(x => {
            btn.innerText = "Project Parsed"
        })
        btn.innerText = "Parsing..."
    })
    div.prepend(btn)
}

/**
 * 
 * @param {String} link 
 * @param {DOMParser} parser 
 */
async function extractRairityRequest(link, parser) {
    return new Promise((resolve, reject) => {
        fetch(link).then(response => {
            if (response.redirected) return reject("Request Redirected");
            return response.text()
        })
            .then(text => {
                const doc = parser.parseFromString(text, 'text/html');
                guide_extract_assets(doc)
                    .then(() => {
                        resolve(true)
                    })
                    .catch(e => {
                        reject(e)
                    })

            })
            .catch(e => reject(e))
    })

}

/**
 * 
 */
async function showExtractionBtnRequests() {
    const btn = document.createElement("button")
    const div = document.querySelector("body > section:nth-child(4) > div")
    const arrayId = Array.from(div.querySelectorAll('table>tbody>tr')).map(tr => tr.querySelector('td').innerText)
    const parser = new DOMParser();

    btn.innerText = "Parse Rarity"
    btn.classList.add("button", "is-info")
    btn.setAttribute("state", "0")

    btn.addEventListener("click", async function (event) {
        if (btn.getAttribute("state") === "1") return;

        btn.setAttribute("state", "1")
        for (let i = 0; i < arrayId.length; i++) {
            let x = arrayId[i];
            let link = `https://rarity.guide/project/${x}/ranking`

            btn.innerText = `Parsing Project ID:${x}`
            try {
                await extractRairityRequest(link, parser)
                await sleep(100)
            } catch (e) {

            }
        }
        btn.innerText = "Projects Parsed"
        btn.setAttribute("state", "0")

    })
    div.prepend(btn);
}

/**
 * 
 * @param {HTMLDocument} doc
 * @param {String} tokenId
 */
function extractRarityA142(doc, tokenId) {
    const rarity = doc.querySelector('table[class="table"] tr:last-child td:nth-child(2)').innerText.split(" ")[0]
    return {
        rank: rarity,
        rarity,
        assetName: null,
        tokenId,
        collection: "ai42-loops"
    }
}
/**
 * 
 * @param {String} tokenId 
 * @param {DOMParser} parser 
 */
async function extractRarityRequestA142(tokenId, parser) {
    return new Promise((resole, reject) => {
        fetch(`https://app.ai42.art/page_detail.php?loopid=${tokenId}`).then(
            response => {
                if (response.redirected) return reject("Request Redirected");
                return response.text()
            })
            .then(async text => {
                const doc = parser.parseFromString(text, 'text/html');
                const details = extractRarityA142(doc, tokenId)
                resole(details)
            })
            .catch(e => reject(e))
    })
}

/**
 * 
 * @param {String} previous 
 * @returns 
 */
function getA142ID(previous = null) {
    if (previous === "10101") return null;
    if (previous == null) return "00001";
    let a = parseInt(previous)
    return Array((5 - String(parseInt(a)).length)).fill(0).join('') + `${parseInt(a) + 1}`

}

/** */
async function showExtractionBtnAI42() {
    let strAnchor = `<li class="nav-item">
                        <a class="nav-link" href="account" span="">Parse Rarity</span></a> 
                    </li>`,
        elemAnchor = createHTML(strAnchor), a = elemAnchor.querySelector('a'),
        elemNavbar = document.querySelector("ul[class='navbar-nav mr-auto']"),
        parser = new DOMParser();

    a.setAttribute("state", "0")
    a.addEventListener('click', async function (event) {
        event.preventDefault();
        if (a.getAttribute("state") === "1") return;

        a.setAttribute("state", "1")
        let payload = []
        let startToken = getA142ID()

        while (startToken != null) {
            try {
                a.innerText = `Parsing ID:${startToken}`
                let result = await extractRarityRequestA142(startToken, parser)
                payload.push(result)
                startToken = getA142ID(startToken)
                await sleep(100)

                // Store results in batches
                if (payload.length > 500) {
                    postMessageToExtension({
                        cmd: "TASK_RESULT",
                        results: payload
                    })
                    payload = []
                }
            } catch (e) {
                console.log(e)
                break
            }
        }

        if (payload.length) {
            postMessageToExtension({
                cmd: "TASK_RESULT",
                results: payload
            })
        }
        a.setAttribute("state", "0")
        a.innerText = "Parsed"
    })

    elemNavbar.appendChild(elemAnchor)
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
function findDetail(entry, tokenId, collection, project_name, assetName) {
    if (entry.hasOwnProperty('extras') && project_name) {
        return (
            (entry.tokenId === tokenId) &&
            collection.startsWith(entry.collection_prefix) &&
            (entry.extras.project_name.toLocaleLowerCase().trim() === project_name.toLocaleLowerCase().trim())
        );
    }
    // check if asset token matches 
    let tokenmatch = (entry.tokenId === tokenId && entry.collection === collection)
    if (tokenmatch) return true

    // check if asset name matches
    return (entry.assetName === assetName && entry.collection === collection)
}

/**
 * 
 * @param {HTMLElement} node 
 * @returns 
 */
async function _doUpdateListingPage(assetNode) {
    return new Promise((resolve, reject) => {
        let { tokenId, project_name, assetName } = getAssetTokenId(assetNode)
        let collection = getAssetCollection(assetNode)

        if (!collection || !(tokenId || assetName)) return resolve(true);
        let info = assets.find(x => findDetail(x, tokenId, collection, project_name, assetName))
        if (info) {
            const node = assetNode.getElementsByClassName('AssetCardFooter--collection')[0].parentElement
            const rank = document.createElement('div')

            rank.innerText = info.rank
            rank.classList.add("AssetCardFooter--name")
            rank.style.cssText = "font-size: 16px; color: red;"

            rank.setAttribute('id', "rank")
            x = node.querySelector('#rank')
            if (!x) node.appendChild(rank);
        }
        resolve(true)
    })
}

/**
 * 
 * @returns 
 */
async function _doUpdateDetailPage() {
    debug("Updating Asset page")
    let p, d, t, c, x, y, i, a, a_i
    d = document.querySelector('div[class="item--wrapper"]')
    if (!d) return false;

    t = d.querySelector('h1[class*="item--title"]')
    t = t ? t.innerText : ''
    a = t

    t = t.match(/#\S+/g) ? t.match(/#\S+/g) : []
    t = t.length ? t[0] : null
    if (t) { t = t.split("#")[1]; }
    else {
        a_i = Array.from(document.querySelectorAll('div[class="ChainInfo--label"]')).map(x => {
            return {
                prop: x.querySelector('.ChainInfo--label-type').innerText,
                value: x.querySelector('.ChainInfo--label-value').innerText
            }
        })
        a_i = a_i.find(x => x.prop === 'Token ID')
        if (a_i) t = a_i.value;
    }

    c = d.querySelector('a[class*="CollectionLink--link"]').href.split('/').pop()
    if (!c || !(t || a)) return false;

    i = assets.find(q => findDetail(q, t, c, p, a))
    if (!i) return;
    if (d.querySelector("#rank")) return false;

    x = d.querySelector('section[class="item--counts"]')
    y = `<div style="display: flex;" id="rank">
            <div>
                <span style="font-size: 16px;color: red;">
                    ${i.rank}
                </span>
            </div>
        </div>`
    x.appendChild(createHTML(y))
    debug("Asset page updated")
}

/**
 * 
 */
async function updateAssets() {
    let _assets = getAssets();
    let promises = [];

    debug(`Updating Assets`);
    _assets.map(x => promises.push(_doUpdateListingPage(x)))
    Promise.allSettled(promises)

    await _doUpdateDetailPage();
    debug("Assets Updated")

}

/**
 * 
 * @returns {Array<HTMLElement>}
 */
function getAssets() {
    return Array.from(
        document.querySelectorAll('.Asset--loaded')
    )
}

/**
  * @param {HTMLElement} assetNode
 */
function getAssetCollection(assetNode) {
    let collection = assetNode.getElementsByClassName('AssetCardFooter--collection')
    collection = collection.length ? collection[0].innerText.trim() : ''
    let entry = assetCollections.collections.find(x => x.name === collection)
    if (entry) return entry.id;
    return collection.toLocaleLowerCase().replaceAll(' ', '-');
}

/**
  * @param {Element} assetNode
 */
function getAssetTokenId(assetNode) {
    let tokenId, project_name, assetName

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
    assetName = info

    return { tokenId, project_name, assetName }
}


/**
 * 
 * @returns 
 */
function registerAssetDetection() {
    document.arrive('.Asset--loaded', function () {
        _doUpdateListingPage(this)
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

/**
 * 
 * @param {HTMLDocument} d 
 */
async function guide_extract_assets(d) {
    // take first table
    let table = null;
    while (table == null) {
        await sleep(1000)
        table = d.querySelector('table')
    }

    // Extract headers
    const headers = Array.from(table.querySelectorAll('thead>tr')).map(
        x => {
            return Array.from(x.querySelectorAll('th')).map(x => x.innerText)
        }
    )[0]

    // Extract project details 
    const info = d.querySelector("body > section:nth-child(2) > div > nav > ul > li:nth-child(2) > a")
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
            assetName: null,
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
    debug(`Starting Rairity Extraction`);

    let { pageIndicator, totalPage, nextSelector } = await getAssetPaginator()
    if (!pageIndicator) return;
    const payload = []

    do {
        debug(`Extracting Rarity Page:${pageIndicator.value}`);
        // @marcelo-mason This is necessary to obtain correct assetNames
        let t = 0
        if (options.collection === "london-gift-v2") {
            while (document.querySelector('.animate-spin ') != null) {
                if (t == 50) break;
                await sleep(1000)
                t += 1

            }
        }

        const assets = document.querySelectorAll(assetLinkSelector)
        if (!assets.length) break;
        for (let i = 0; i < assets.length; i++) {

            const asset = assets[i];

            let rarity = ""
            let rank = asset.querySelector(".font-extrabold")
            if (rank) {
                rank = rank.innerText.split(" ").pop()
            }

            let tokenId = assetName = null;
            if (options.collection === "london-gift-v2") {
                assetName = asset.querySelector('a[href*="opensea.io/assets/"]')
                if (assetName) {
                    assetName = assetName.innerText.trim();
                }
            } else {
                tokenId = asset.querySelector('a[href*="opensea.io/assets/"]')
                if (tokenId) {
                    tokenId = tokenId.innerText.split(" ").pop()
                    tokenId = tokenId.substr(1)
                }
            }
            if (!rank || !(tokenId || assetName)) continue;

            payload.push({
                rarity,
                rank,
                tokenId,
                assetName,
                collection: options.collection
            })
        }
        nextSelector.click()
        await sleep(100)

    } while (!(parseInt(pageIndicator.value) == parseInt(totalPage)) && parsingState == 1);

    if (payload.length) {
        postMessageToExtension({
            cmd: "TASK_RESULT",
            results: payload
        })
    }

    let btn = document.querySelector("#parse_collection")
    btn.innerText = "PARSED"
    btn.setAttribute('state', "0")
    debug(`Stopping Rairity Extraction`);



}

