import requester from './requester'

export const uploadImage = ({ imageBlob, imageName = '', authSig }) => {
    let formData = new FormData()
    formData.append('image', imageBlob, imageName)

    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'image',
            method: 'POST',
            body: formData,
            authSig: authSig
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const regItem = ({ item, authSig }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'items',
            method: 'POST',
            body: JSON.stringify(item),
            authSig: authSig,
            headers: { 'Content-Type': 'application/json' }
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const getItems = ({ type, authSig }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'items',
            method: 'GET',
            queryParams: { 'type': type },
            authSig: authSig
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const delItem = ({ id, type, authSig }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'items',
            method: 'DELETE',
            queryParams: { 'type': type, id: id },
            authSig: authSig
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const addItmToItm = ({ item, type, collection, authSig }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'item-to-item',
            method: 'POST',
            authSig: authSig,
            queryParams: { type: type, item: item, collection: collection },
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const removeItmFromItm = ({ item, type, collection, authSig }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'item-to-item',
            method: 'DELETE',
            authSig: authSig,
            queryParams: { type: type, item: item, collection: collection },
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const getCollectionItems = ({ id, authSig }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'collection',
            method: 'GET',
            authSig: authSig,
            queryParams: { id: id },
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const placeBid = ({ bid, unit, authSig }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'bids',
            method: 'POST',
            body: JSON.stringify(bid),
            authSig: authSig,
            headers: { 'Content-Type': 'application/json' }
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

const getBids = ({ authSig, query }) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'bids',
            method: 'GET',
            authSig: authSig,
            queryParams: query
        })
            .then((resp) => {
                return resolve(resp.json())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const getUnitBids = ({ authSig, adUnit }) => {
    let query = {
        unit: adUnit
    }

    return getBids({ authSig: authSig, query: query })
}

export const getSlotBids = ({ authSig, adSlot }) => {
    let query = {
        slot: adSlot
    }

    return getBids({ authSig: authSig, query: query })
}

export const getAvailableBids = ({ authSig, sizeAndType }) => {
    let query = {
        sizeAndType: sizeAndType
    }

    return getBids({ authSig: authSig, query: query })
}

export const getAuthToken = ({ authSig } = {}) => {
    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'auth',
            method: 'GET'
        })
            .then((res) => {
                return resolve(res.text())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}

export const signToken = ({ userid, signature, authToken, mode } = {}) => {
    let query = {
        userid: userid,
        signature: signature,
        authToken: authToken,
        mode: mode
    }

    return new Promise((resolve, reject) => {
        requester.fetch({
            route: 'auth',
            method: 'POST',
            queryParams: query
        })
            .then((res) => {
                return resolve(res.text())
            })
            .catch((err) => {
                return reject(err)
            })
    })
}