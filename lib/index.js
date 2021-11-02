const mysql = require('mysql')
const tunnel = require('tunnel-ssh')
const fs = require('fs')
const pluralize = require('pluralize')
require('dotenv').config()

const DEBUG_MODE = ['true', 'TRUE', '1'].includes(process.env.DEBUG_MODE)
const {
  connection,
  ssh_conf,
} = (() => {
  if (process.env.SSH_HOST) {
    const connection = mysql.createConnection({
      host     : '127.0.0.1',
      user     : process.env.DB_USER,
      password : process.env.DB_PASS,
      database : process.env.DB_NAME,
      port: 27000,
    })

    const ssh_conf = {
      username: process.env.SSH_USER,
      privateKey: fs.readFileSync(process.env.SSH_KEY),
      host: process.env.SSH_HOST,
      port: process.env.SSH_PORT,
      dstHost: process.env.DB_HOST,
      dstPort: process.env.DB_PORT,
      localHost:'127.0.0.1',
      localPort: 27000,
    }
    return {
      connection,
      ssh_conf,
    }
  }
  const connection = mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USER,
    password : process.env.DB_PASS,
    database : process.env.DB_NAME,
    port: process.env.DB_PORT,
  })
  return { connection }
})()

const [table, delete_id] = process.argv.slice(2)
if (!table || !delete_id) {
  console.error(`r2f: illegal useage: wrong parameters got passed.
usage: r2f [table_name] [id]`)
  process.exit(1)
}
const database = process.env.DB_NAME
const possible_key_column = `${pluralize.singular(table)}_id`

const main = () => {
  console.log(`using [${possible_key_column}] to search relations...`)
  const debug = (msg) => { if (DEBUG_MODE) { console.log(msg) } }
  const query = `select table_name, column_name from information_schema.columns where table_schema = '${database}' and column_name like '%${possible_key_column}'
union
select table_name, column_name from information_schema.key_column_usage where referenced_table_schema = '${database}' and referenced_table_name = '${table}'`

  debug(query)
  const handle = (store, data) => {
    const {
      table_name,
      column_name,
      has_deleted_at,
    } = data.shift()
    const q = `select count(1) as count from ${table_name} where ${column_name} = ${delete_id}` + (has_deleted_at ? ' and deleted_at is null' : '')
    debug(q)
    connection.query(q, function (error, results) {
      if (error) throw error
      if (results[0].count > 0) {
        debug(`[${table_name}] has ${results[0].count} records`)
        store.push(table_name)
      } else {
        debug(`[${table_name}] has no records`)
      }
      if (data.length === 0) {
        debug('that was all')
        if (store.length === 0) {
          console.log('there were no relations found.')
        } else {
          console.log(`relations found:`)
          console.log(store)
        }
        connection.end()
      } else {
        handle(store, data)
      }
    })
  }
  connection.query(query, function (error, results) {
    debug(results)
    if (error) throw error
    const tmp = results.map(r => ({ table_name: r.TABLE_NAME, column_name: r.COLUMN_NAME }))
    debug(tmp)
    const table_names = tmp.map(r => `'${r.table_name}'`).join(',')
    const deleted_at_finding_query = `select table_name, column_name from information_schema.columns where table_schema = '${database}' and table_name in (${table_names}) and column_name = 'deleted_at'`
    debug(deleted_at_finding_query)
    connection.query(deleted_at_finding_query, function (error, results) {
      if (error) throw error
      const check_list = tmp.map(r => {
        const index = results.findIndex(row => row.table_name === r.table_name)
        r.has_deleted_at = index !== -1
        return r
      })
      const store = []
      debug(`found relations:`)
      debug(check_list)
      handle(store, check_list)
    })
  })
}

const connect_and_start = () => {
  connection.connect()
  connection.query(`select 1 as v from information_schema.tables where table_schema = '${database}' and table_name = '${table}'`, function (error, results) {
    if (error) throw error
    if (results.length === 0) {
      connection.end()
      console.error(`we couldnt find a table named [${table}]`)
      process.exit(1)
    }
    main()
  })
}

if (ssh_conf) {
  tunnel(ssh_conf, function(error, tnl){
    if (error) throw error
    connect_and_start()
  })
} else {
  connect_and_start()
}
