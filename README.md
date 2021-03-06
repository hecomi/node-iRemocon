iRemocon client library for Node.js
=============

これは何？
--------------
iRemocon を操作する Node.js 用モジュールです。

インストール
--------------
	$ npm install iremocon

使い方
--------------
まず、以下のようにモジュールを読み込みます。

	var iRemocon = new require('iRemocon')
	  , iremocon = new iRemocon('192.168.0.1') // iRemocon の IP を指定
	;

iRemocon のコマンドはひと通り揃えてあります。
各コマンドの詳細については公式サイトの開発者向け情報（http://i-remocon.com/development/）を御覧ください。

	// すべてのメソッドにはコールバックを指定することができます
	iremocon.au(function(err, msg) {
		if (!err) console.log('DETECTED!');
	})

コールバック時のエラーは code, error, detail の３つの情報を保持しています。

	// code   : エラーコード（999 は iRemocon で定義されていないエラー）
	// error  : エラーの概略
	// detail : エラーの詳細
	iremocon.ic(1 /* 1〜1500 の ID */, function(err, msg) {
		if (err) {
			console.error(err.code, err.error, err.detail);
			// e.g. 003 受信エラー 不正なリモコンデータを受信した
			return;
		}
		console.log(msg);
		// e.g. ic;ok
	});

コールバックは省略することもできます。

	iremocon.is(1);

また、ネットワーク内の iRemocon を見つけることもできます。

	var iRemocon = new require('iRemocon');

	var ips = []
	for (var i = 1; i < 255; ++i) {
		ips.push('192.168.0.' + i);
	}
	iRemocon.search(ips, function(ip) {
		var iremocon = new iRemocon(ip);
		iremocon.is(10);
	})

詳細
--------------
その他詳細は Twitter:@hecomi へご質問いただくか、http://d.hatena.ne.jp/hecomi/ をご参照下さい。

