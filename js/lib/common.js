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
 * @returns 
 */
 async function getLocalStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, items => {
            try {
                if (key in items) {
                    resolve(items[key])
                }
                resolve(null)
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