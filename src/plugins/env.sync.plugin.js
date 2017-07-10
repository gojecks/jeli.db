
		//Synchronization Plugin
		//Task Called with Env

    jEliDB.plugins.jQl('sync',{
		help : ['-sync  (optional) -[tbl_name] -[force]'],
		fn : syncPluginFn
	});

    function syncPluginFn(query,handler)
	{
		var result = {state:query[0],result:{message:null}};
	    return function(db)
	    {
	      db
	      .synchronize()
	      .Entity(query[1])
	      .configSync(null, query[2])
	      .processEntity(handler);
	    };
	}