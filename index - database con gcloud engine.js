'use strict';

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _knex2 = require('knex');

var _knex3 = _interopRequireDefault(_knex2);

var _pick = require('lodash/pick');

var _pick2 = _interopRequireDefault(_pick);

var _tables = require('./tables');

var _tables2 = _interopRequireDefault(_tables);

var _kvs2 = require('./kvs');

var _kvs3 = _interopRequireDefault(_kvs2);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird2.default(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return _bluebird2.default.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * The db (database) namespace lets you control the database directly via [Knex]{@link http://knexjs.org/}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * @public
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * @namespace Database
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * @example
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  * await knex = bp.db.get()
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  */

const initializeCoreDatabase = (knex, botpressPath) => {
  if (!knex) {
    throw new Error('You must initialize the database before');
  }

  const directory = _path2.default.join(botpressPath, './migrations/');
  return _bluebird2.default.mapSeries(_tables2.default, fn => fn(knex)).then(() => knex.migrate.latest({ directory }));
};

const createKnex = (() => {
  var _ref = _asyncToGenerator(function* ({ sqlite, postgres, botpressPath, logger }) {
    const commonConfig = {
      useNullAsDefault: true
    };
	
	const gcloudcnx = {
		user: postgres.user,
		password: postgres.password,
		database: postgres.database
	};
	
	if (process.env.INSTANCE_CONNECTION_NAME && process.env.NODE_ENV === 'production') {
		gcloudcnx.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
	}

	
	console.log(gcloudcnx);
	
    const dbConfig = postgres.enabled ? {
      client: 'pg',
	  connection: gcloudcnx
	  //connection: postgres.config
      //connection: postgres.connection || (0, _pick2.default)(postgres, ['host', 'port', 'user', 'password', 'database', 'ssl'])
    } : {
      client: 'sqlite3',
      connection: { filename: sqlite.location },
      pool: {
        afterCreate: function (conn, cb) {
          conn.run('PRAGMA foreign_keys = ON', cb);
        }
      }
    };

    const _knex = (0, _knex3.default)(Object.assign(commonConfig, dbConfig));

    yield initializeCoreDatabase(_knex, botpressPath);
    return _knex;
  });

  return function createKnex(_x) {
    return _ref.apply(this, arguments);
  };
})();

module.exports = ({ sqlite, postgres, logger, botpressPath }) => {
  let knex = null;

  const getDb = (() => {
    var _ref2 = _asyncToGenerator(function* () {
      if (!knex) {
        knex = yield createKnex({ sqlite, postgres, botpressPath, logger });
      }

      return knex;
    });

    return function getDb() {
      return _ref2.apply(this, arguments);
    };
  })();

  const saveUser = ({
    id,
    platform,
    gender = 'unknown',
    timezone = null,
    locale = null,
    picture_url,
    first_name,
    last_name
  }) => {
    const userId = platform + ':' + id;
    const userRow = {
      id: userId,
      userId: id,
      platform,
      gender,
      timezone,
      locale,
      created_on: (0, _moment2.default)(new Date()).toISOString(),
      picture_url: picture_url,
      last_name: last_name,
      first_name: first_name
    };

    return getDb().then(knex => {
      let query = knex('users').insert(userRow).where(function () {
        return this.select(knex.raw(1)).from('users').where('id', '=', userId);
      });

      if (postgres.enabled) {
        query = `${query} on conflict (id) do nothing`;
      } else {
        // SQLite
        query = query.toString().replace(/^insert/i, 'insert or ignore');
      }

      return knex.raw(query);
    });
  };

  let kvsInstance = null;

  const createKvs = (() => {
    var _ref3 = _asyncToGenerator(function* () {
      const knex = yield getDb();
      const _kvs = (0, _kvs3.default)(knex);
      yield _kvs.bootstrap();
      return _kvs;
    });

    return function createKvs() {
      return _ref3.apply(this, arguments);
    };
  })();

  const getKvs = (() => {
    var _ref4 = _asyncToGenerator(function* () {
      if (!kvsInstance) {
        kvsInstance = createKvs();
      }

      return kvsInstance;
    });

    return function getKvs() {
      return _ref4.apply(this, arguments);
    };
  })();

  const kvsGet = (...args) => getKvs().then(instance => instance.get(...args));
  const kvsSet = (...args) => getKvs().then(instance => instance.set(...args));

  const kvsWrapper = { get: kvsGet, set: kvsSet };

  return {
    /**
     * Returns an initialized and connected instance of [Knex]{@link http://knexjs.org/}.
     * Knex is a SQL Query Builder and database abstractor that Botpress (and every Botpress modules) use internally.
     * [Knex Documentation]{@link http://knexjs.org/#Builder}
     * @func
     * @async
     * @memberOf! Database
     * @return {KnexQueryBuilder}
     */
    get: getDb,
    saveUser,
    location: postgres.enabled ? 'postgres' : sqlite.location,
    get kvs() {
      logger && logger.warn('[Deprecation Notice] `bp.db.kvs` is deprecated and will be removed in Botpress 11. Please use `bp.kvs` directly instead.');
      return kvsWrapper;
    },
    _kvs: kvsWrapper
  };
};
//# sourceMappingURL=index.js.map