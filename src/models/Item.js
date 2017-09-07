// import Helper from './tempHelpers'

class Item {
    constructor(owner, id, type, name, img, description){
        this._id = id
        this._owner = owner
        this._type = type
        this._name = name
        this._meta = {
            img: img,
            description: description,
            createdOn: Date.now(), // TODO: fix date format
            modifiedOn: null, //
            archived: false,
            deleted: false
        }
    }

    get id() { return this._id }
    get owner() { return this._owner }
    get type() { return this._type }

    get name() { return this._name }
    set name(value) { this._name = value }

    get img() { return this._meta.img }
    set img(value) { this._meta.img = value }

    get description() { return this._meta.description }
    set description(value) { this._meta.description = value }

    get archived() { return this._meta.archived }
    set archived(value) { this._meta.archived = value }

    get deleted() { return this._meta.deleted }
    set deleted(value) { this._meta.deleted = value }

    get createdOn() { return this._meta.createdOn }
    set createdOn(value) { this._meta.createdOn = value }

    get modifiedOn() { return this._meta.modifiedOn }
    set modifiedOn(value) { this._meta.modifiedOn = value }

    get meta() { return this._meta }
    // set meta(value) { this._meta = value }
}

export default Item
