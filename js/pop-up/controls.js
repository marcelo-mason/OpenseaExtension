const Controls = {}
Controls.OVER_RIDES = {
    query: ""
}

/**
 * 
 * @param {String} key 
 */

Controls.getLocalStorage = async function (key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(key, items => {
            try {
                if (key in items) {
                    resolve(items[key])
                }
                if (key in Controls.OVER_RIDES) {
                    resolve(Controls.OVER_RIDES[key])
                    return
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
Controls.setLocalStorage = async function (key, value) {
    return new Promise((resolve, reject) => {
        var data = {}
        data[key] = value
        chrome.storage.sync.set(data, function () {
            resolve(true)
        });
    })
}

/**
 * 
 * @param {*} key 
 */
Controls.removeLocalStorage = async function (key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.remove(key, () => {
            resolve(true)
        })
    });
}

