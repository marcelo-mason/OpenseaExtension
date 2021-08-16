var parseQuery = (function (d, x, params, p, i, j) {
    /**
     * 
     * @param {String} qs 
     * @returns {Object}
     */
    const S = function (qs) {
        params = {};
        if (!qs || !typeof qs === "string") return params;
        try {
            qs = qs
                .substring(qs.indexOf("?") + 1)
                .replace(x, " ")
                .split("&");
            for (i = qs.length; i > 0;) {
                p = qs[--i];
                j = p.indexOf("=");
                if (j === -1) params[d(p)] = undefined;
                else params[d(p.substring(0, j))] = d(p.substring(j + 1));
            }
        } catch (error) {
            return params;
        }
        return params;
    };
    return S
})(decodeURIComponent, /\+/g);


/**
 *
 * @param {Number} ms
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 
 * @param {*} key 
 * @param {*} _d 
 * @returns 
 */
async function getLocalStorage(key, _d = null) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, items => {
            try {
                if (key in items) {
                    resolve(items[key])
                }
                resolve(_d)
            } catch (error) {
                reject(error)
            }
        })
    })
}

/**
 * 
 * @param {String} key 
 * @param {Object} value 
 */
async function setLocalStorage(key, value) {
    return new Promise((resolve, reject) => {
        var data = {}
        data[key] = value
        chrome.storage.local.set(data, function () {
            resolve(true)
        });
    })
}

/**
 * 
 * @returns 
 */
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
    setLocalStorage('collections', response)
    return response
}
