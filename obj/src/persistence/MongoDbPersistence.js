"use strict";
/** @module persistence */
Object.defineProperty(exports, "__esModule", { value: true });
let _ = require('lodash');
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const pip_services3_commons_node_2 = require("pip-services3-commons-node");
const pip_services3_commons_node_3 = require("pip-services3-commons-node");
const pip_services3_commons_node_4 = require("pip-services3-commons-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const MongoDbConnection_1 = require("./MongoDbConnection");
/**
 * Abstract persistence component that stores data in MongoDB using plain driver.
 *
 * This is the most basic persistence component that is only
 * able to store data items of any type. Specific CRUD operations
 * over the data items must be implemented in child classes by
 * accessing <code>this._db</code> or <code>this._collection</code> properties.
 *
 * ### Configuration parameters ###
 *
 * - collection:                  (optional) MongoDB collection name
 * - connection(s):
 *   - discovery_key:             (optional) a key to retrieve the connection from [[https://rawgit.com/pip-services-node/pip-services3-components-node/master/doc/api/interfaces/connect.idiscovery.html IDiscovery]]
 *   - host:                      host name or IP address
 *   - port:                      port number (default: 27017)
 *   - uri:                       resource URI or connection string with all parameters in it
 * - credential(s):
 *   - store_key:                 (optional) a key to retrieve the credentials from [[https://rawgit.com/pip-services-node/pip-services3-components-node/master/doc/api/interfaces/auth.icredentialstore.html ICredentialStore]]
 *   - username:                  (optional) user name
 *   - password:                  (optional) user password
 * - options:
 *   - max_pool_size:             (optional) maximum connection pool size (default: 2)
 *   - keep_alive:                (optional) enable connection keep alive (default: true)
 *   - connect_timeout:           (optional) connection timeout in milliseconds (default: 5000)
 *   - socket_timeout:            (optional) socket timeout in milliseconds (default: 360000)
 *   - auto_reconnect:            (optional) enable auto reconnection (default: true)
 *   - reconnect_interval:        (optional) reconnection interval in milliseconds (default: 1000)
 *   - max_page_size:             (optional) maximum page size (default: 100)
 *   - replica_set:               (optional) name of replica set
 *   - ssl:                       (optional) enable SSL connection (default: false)
 *   - auth_source:               (optional) authentication source
 *   - debug:                     (optional) enable debug output (default: false).
 *
 * ### References ###
 *
 * - <code>\*:logger:\*:\*:1.0</code>           (optional) [[https://rawgit.com/pip-services-node/pip-services3-components-node/master/doc/api/interfaces/log.ilogger.html ILogger]] components to pass log messages
 * - <code>\*:discovery:\*:\*:1.0</code>        (optional) [[https://rawgit.com/pip-services-node/pip-services3-components-node/master/doc/api/interfaces/connect.idiscovery.html IDiscovery]] services
 * - <code>\*:credential-store:\*:\*:1.0</code> (optional) Credential stores to resolve credentials
 *
 * ### Example ###
 *
 *     class MyMongoDbPersistence extends MongoDbPersistence<MyData> {
 *
 *       public constructor() {
 *           base("mydata");
 *       }
 *
 *       public getByName(correlationId: string, name: string, callback: (err, item) => void): void {
 *         let criteria = { name: name };
 *         this._model.findOne(criteria, callback);
 *       });
 *
 *       public set(correlatonId: string, item: MyData, callback: (err) => void): void {
 *         let criteria = { name: item.name };
 *         let options = { upsert: true, new: true };
 *         this._model.findOneAndUpdate(criteria, item, options, callback);
 *       }
 *
 *     }
 *
 *     let persistence = new MyMongoDbPersistence();
 *     persistence.configure(ConfigParams.fromTuples(
 *         "host", "localhost",
 *         "port", 27017
 *     ));
 *
 *     persitence.open("123", (err) => {
 *          ...
 *     });
 *
 *     persistence.set("123", { name: "ABC" }, (err) => {
 *         persistence.getByName("123", "ABC", (err, item) => {
 *             console.log(item);                   // Result: { name: "ABC" }
 *         });
 *     });
 */
class MongoDbPersistence {
    /**
     * Creates a new instance of the persistence component.
     *
     * @param collection    (optional) a collection name.
     */
    constructor(collection) {
        this._indexes = [];
        /**
         * The dependency resolver.
         */
        this._dependencyResolver = new pip_services3_commons_node_4.DependencyResolver(MongoDbPersistence._defaultConfig);
        /**
         * The logger.
         */
        this._logger = new pip_services3_components_node_1.CompositeLogger();
        this._collectionName = collection;
    }
    /**
     * Configures component by passing configuration parameters.
     *
     * @param config    configuration parameters to be set.
     */
    configure(config) {
        config = config.setDefaults(MongoDbPersistence._defaultConfig);
        this._config = config;
        this._dependencyResolver.configure(config);
        this._collectionName = config.getAsStringWithDefault("collection", this._collectionName);
    }
    /**
     * Sets references to dependent components.
     *
     * @param references 	references to locate the component dependencies.
     */
    setReferences(references) {
        this._references = references;
        this._logger.setReferences(references);
        // Get connection
        this._dependencyResolver.setReferences(references);
        this._connection = this._dependencyResolver.getOneOptional('connection');
        // Or create a local one
        if (this._connection == null) {
            this._connection = this.createConnection();
            this._localConnection = true;
        }
        else {
            this._localConnection = false;
        }
    }
    /**
     * Unsets (clears) previously set references to dependent components.
     */
    unsetReferences() {
        this._connection = null;
    }
    createConnection() {
        let connection = new MongoDbConnection_1.MongoDbConnection();
        if (this._config)
            connection.configure(this._config);
        if (this._references)
            connection.setReferences(this._references);
        return connection;
    }
    /**
     * Adds index definition to create it on opening
     * @param keys index keys (fields)
     * @param options index options
     */
    ensureIndex(keys, options) {
        if (keys == null)
            return;
        this._indexes.push({
            keys: keys,
            options: options
        });
    }
    /**
     * Converts object value from internal to public format.
     *
     * @param value     an object in internal format to convert.
     * @returns converted object in public format.
     */
    convertToPublic(value) {
        if (value) {
            if (value._id != undefined) {
                value.id = value._id;
                delete value._id;
            }
        }
        return value;
    }
    /**
     * Convert object value from public to internal format.
     *
     * @param value     an object in public format to convert.
     * @returns converted object in internal format.
     */
    convertFromPublic(value) {
        if (value) {
            if (value.id != undefined) {
                value._id = value._id || value.id;
                delete value.id;
            }
        }
        return value;
    }
    /**
     * Checks if the component is opened.
     *
     * @returns true if the component has been opened and false otherwise.
     */
    isOpen() {
        return this._opened;
    }
    /**
     * Opens the component.
     *
     * @param correlationId 	(optional) transaction id to trace execution through call chain.
     * @param callback 			callback function that receives error or null no errors occured.
     */
    open(correlationId, callback) {
        if (this._opened) {
            callback(null);
            return;
        }
        if (this._connection == null) {
            this._connection = this.createConnection();
            this._localConnection = true;
        }
        let openCurl = (err) => {
            if (err == null && this._connection == null) {
                err = new pip_services3_commons_node_3.InvalidStateException(correlationId, 'NO_CONNECTION', 'MongoDB connection is missing');
            }
            if (err == null && !this._connection.isOpen()) {
                err = new pip_services3_commons_node_2.ConnectionException(correlationId, "CONNECT_FAILED", "MongoDB connection is not opened");
            }
            this._opened = false;
            if (err) {
                if (callback)
                    callback(err);
            }
            else {
                this._client = this._connection.getConnection();
                this._db = this._connection.getDatabase();
                this._databaseName = this._connection.getDatabaseName();
                this._db.collection(this._collectionName, (err, collection) => {
                    if (err) {
                        this._db = null;
                        this._client == null;
                        err = new pip_services3_commons_node_2.ConnectionException(correlationId, "CONNECT_FAILED", "Connection to mongodb failed").withCause(err);
                        if (callback)
                            callback(err);
                        return;
                    }
                    // Recreate indexes
                    async.each(this._indexes, (index, callback) => {
                        collection.createIndex(index.keys, index.options, (err) => {
                            if (err == null) {
                                let options = index.options || {};
                                let indexName = options.name || _.keys(index.keys).join(',');
                                this._logger.debug(correlationId, "Created index %s for collection %s", indexName, this._collectionName);
                            }
                            callback(err);
                        });
                    }, (err) => {
                        if (err) {
                            this._db = null;
                            this._client == null;
                            err = new pip_services3_commons_node_2.ConnectionException(correlationId, "CONNECT_FAILED", "Connection to mongodb failed").withCause(err);
                        }
                        else {
                            this._opened = true;
                            this._collection = collection;
                            this._logger.debug(correlationId, "Connected to mongodb database %s, collection %s", this._databaseName, this._collectionName);
                        }
                        if (callback)
                            callback(err);
                    });
                });
            }
        };
        if (this._localConnection) {
            this._connection.open(correlationId, openCurl);
        }
        else {
            openCurl(null);
        }
    }
    /**
     * Closes component and frees used resources.
     *
     * @param correlationId 	(optional) transaction id to trace execution through call chain.
     * @param callback 			callback function that receives error or null no errors occured.
     */
    close(correlationId, callback) {
        if (!this._opened) {
            callback(null);
            return;
        }
        if (this._connection == null) {
            callback(new pip_services3_commons_node_3.InvalidStateException(correlationId, 'NO_CONNECTION', 'MongoDb connection is missing'));
            return;
        }
        let closeCurl = (err) => {
            this._opened = false;
            this._client = null;
            this._db = null;
            this._collection = null;
            if (callback)
                callback(err);
        };
        if (this._localConnection) {
            this._connection.close(correlationId, closeCurl);
        }
        else {
            closeCurl(null);
        }
    }
    /**
     * Clears component state.
     *
     * @param correlationId 	(optional) transaction id to trace execution through call chain.
     * @param callback 			callback function that receives error or null no errors occured.
     */
    clear(correlationId, callback) {
        // Return error if collection is not set
        if (this._collectionName == null) {
            if (callback)
                callback(new Error('Collection name is not defined'));
            return;
        }
        // this._db.dropCollection(this._collectionName, (err) => {
        //     if (err && (err.message != "ns not found" || err.message != "topology was destroyed"))
        //         err = null;
        //     if (err) {
        //         err = new ConnectionException(correlationId, "CONNECT_FAILED", "Connection to mongodb failed")
        //             .withCause(err);
        //     }
        //     if (callback) callback(err);
        // });
        this._collection.deleteMany({}, (err, result) => {
            if (err) {
                err = new pip_services3_commons_node_2.ConnectionException(correlationId, "CONNECT_FAILED", "Connection to mongodb failed")
                    .withCause(err);
            }
            if (callback)
                callback(err);
        });
    }
}
exports.MongoDbPersistence = MongoDbPersistence;
MongoDbPersistence._defaultConfig = pip_services3_commons_node_1.ConfigParams.fromTuples("collection", null, "dependencies.connection", "*:connection:mongodb:*:1.0", 
// connections.*
// credential.*
"options.max_pool_size", 2, "options.keep_alive", 1, "options.connect_timeout", 5000, "options.auto_reconnect", true, "options.max_page_size", 100, "options.debug", true);
//# sourceMappingURL=MongoDbPersistence.js.map