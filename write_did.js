/**
 * Example demonstrating how to add DID with the role of Trust Anchor as Steward.
 *
 * Uses seed to obtain Steward's DID which already exists on the ledger.
 * Then it generates new DID/Verkey pair for Trust Anchor.
 * Using Steward's DID, NYM transaction request is built to add Trust Anchor's DID and Verkey
 * on the ledger with the role of Trust Anchor.
 * Once the NYM is successfully written on the ledger, it generates new DID/Verkey pair that represents
 * a client, which are used to create GET_NYM request to query the ledger and confirm Trust Anchor's Verkey.
 *
 * For the sake of simplicity, a single wallet is used. In the real world scenario, three different wallets
 * would be used and DIDs would be exchanged using some channel of communication
 */

 const fs = require('fs')
 const indy = require('indy-sdk')
 const util = require('./util')
 const colors = require('./colors')
 
 const log = console.log
 
 function logValue() {
     log(colors.CYAN, ...arguments, colors.NONE)
 }
 
 async function run() {
 
     log("Set protocol version 2 to work with Indy Node 1.4")
     await indy.setProtocolVersion(2)
 
     // Step 2 code goes here.
     log('1. Creates a new local pool ledger configuration that is used later when connecting to ledger.')
     const poolName = 'pool'
     const genesisFilePath = await util.getPoolGenesisTxnPath(poolName).catch(err=>{})
     const poolConfig = {'genesis_txn': genesisFilePath}
     await indy.createPoolLedgerConfig(poolName, poolConfig).catch(err=>{})
     
     log('2. Open pool ledger and get handle from libindy')
    const poolHandle = await indy.openPoolLedger(poolName, undefined).catch(err=>console.log(err))

    log('3. Creating new secure wallet')
    const walletName = {"id": "wallet"}
    const walletCredentials = {"key": "wallet_key"}
    
    await indy.createWallet(walletName, walletCredentials).catch(err=>{})
    
    log('4. Open wallet and get handle from libindy')
    const walletHandle = await indy.openWallet(walletName, walletCredentials)
 
     // Step 3 code goes here.
         
    log('5. Generating and storing steward DID and verkey')
    const stewardSeed = '000000000000000000000000Steward1'
    const did = {'seed': stewardSeed}
    const [stewardDid, stewardVerkey] = await indy.createAndStoreMyDid(walletHandle, did)
    logValue('Steward DID: ', stewardDid)
    logValue('Steward Verkey: ', stewardVerkey)

    // Now, create a new DID and verkey for a trust anchor, and store it in our wallet as well. Don't use a seed;
    // this DID and its keys are secure and random. Again, we're not writing to the ledger yet.

    log('6. Generating and storing trust anchor DID and verkey')
    const [trustAnchorDid, trustAnchorVerkey] = await indy.createAndStoreMyDid(walletHandle, "{}")
    logValue('Trust anchor DID: ', trustAnchorDid)
    logValue('Trust anchor Verkey: ', trustAnchorVerkey)
 
     // Step 4 code goes here.
    log('7. Building NYM request to add Trust Anchor to the ledger')
    const nymRequest = await indy.buildNymRequest(/*submitter_did*/ stewardDid,
        /*target_did*/ trustAnchorDid,
        /*ver_key*/ trustAnchorVerkey,
        /*alias*/ undefined,
        /*role*/ 'TRUST_ANCHOR')

    log('8. Sending NYM request to the ledger')
    await indy.signAndSubmitRequest(/*pool_handle*/ poolHandle,
        /*wallet_handle*/ walletHandle,
        /*submitter_did*/ stewardDid,
        /*request_json*/ nymRequest)
 
     // Step 5 code goes here.
     log('9. Generating and storing DID and verkey representing a Client that wants to obtain Trust Anchor Verkey')
     const [clientDid, clientVerkey] = await indy.createAndStoreMyDid(walletHandle, "{}")
     logValue('Client DID: ', clientDid)
     logValue('Client Verkey: ', clientVerkey)
 
     log('10. Building the GET_NYM request to query trust anchor verkey')
     const getNymRequest = await indy.buildGetNymRequest(/*submitter_did*/ clientDid,
         /*target_did*/ trustAnchorDid)

    log('11. Sending the Get NYM request to the ledger')
    const getNymResponse = await indy.submitRequest(/*pool_handle*/ poolHandle,
        /*request_json*/ getNymRequest)

    log('12. Comparing Trust Anchor verkey as written by Steward and as retrieved in GET_NYM response submitted by Client')
    logValue('Written by Steward: ', trustAnchorVerkey)
    const verkeyFromLedger = JSON.parse(getNymResponse['result']['data'])['verkey']
    fs.writeFileSync('./data.json', JSON.stringify(getNymResponse))
    
    logValue('Queried from ledger: ', verkeyFromLedger)
    logValue('Matching: ', verkeyFromLedger == trustAnchorVerkey)
    
    log('13. Closing wallet and pool')
    await indy.closeWallet(walletHandle)
    await indy.closePoolLedger(poolHandle)

    // 14.
    log('14. Deleting created wallet')
    await indy.deleteWallet(walletName, walletCredentials)

    // 15.
    log('15. Deleting pool ledger config')
    await indy.deletePoolLedgerConfig(poolName)
        
 }
 
 
 try {
     run()
 } catch (e) {
     log("ERROR occured : e")
 }