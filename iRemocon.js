/*
 * title   : node-iRemocon
 * date    : 2012/10/05
 * version : 0.0.1
 * author  : hecomi
 */

var net   = require('net')
  , async = require('async')
;

var IREMOCON_PORT    = 51013 // iRemocon の接続先ポート
  , IREMOCON_TIMEOUT = 30000 // iRemocon からの応答のタイムアウト時間 [ms]
;

var iRemocon = function(ip) {
	this.ip_      = ip;
	this.socket_  = null;
	this.timer_   = null; // 接続できなかった時用のタイマ
	this.timeout_ = IREMOCON_TIMEOUT;
}

// iRemocon を与えられた IP の中から検索する
iRemocon.search = function(ips, callback) {
	var iremocon = new iRemocon();
	iremocon.setTimeout(1000);
	async.detectSeries(ips, function(ip, detected) {
		iremocon.setIP(ip);
		setTimeout(function() {
			iremocon.au(function(err, msg) {
				if (err) {
					detected(false);
					return;
				}
				detected(true);
			});
		}, 100);
	}, function(result) {
		callback(result);
	});
};

// iRemocon を発見する
iRemocon.prototype = {
	// コマンド送信
	send : function(command, callback) {
		var res = '';

		// 前のソケットはキャンセル
		if (this.socket_) {
			this.socket_.destroy();
			if (this.timer_) {
				clearTimeout(this.timer_);
				this.timer_ = null;
			}
		}

		// コマンド送信
		var socket = net.createConnection(IREMOCON_PORT, this.ip_, function() {
			// タイムアウトの設定
			socket.setTimeout(this.timeout_, function() {
				callback({
					code   : '999',
					error  : '接続エラー',
					detail : 'iRemocon から応答なし'
				}, '');
				socket.destroy();
				this.socket_ = null;
			});
			socket.write('*' + command + '\r\n');
			this.socket_ = socket;
		}.bind(this));

		// 一定時間たっても接続確立されなかったらエラー
		if (this.timer_) { clearTimeout(this.timer_); }
		this.timer_ = setTimeout(function() {
			if (!this.socket_) {
				callback({
					code   : '999',
					error  : '接続エラー',
					detail : '接続確立出来ない'
				}, '');
				socket.destroy();
				this.timer_ = null;
			}
		}.bind(this), this.timeout_);

		// 部分的な返り値は \r\n が揃うまでつなぎ合わせる
		socket.on('data', function(data) {
			res += data.toString();
			if ( res.match(/\r\n/) ) {
				socket.end();
			}
		});

		// 結果を返す
		socket.on('end', function() {
			// 途中で中断した場合などは過去の結果がついてくるので破棄
			res = res.replace(/\n.*/, '');

			// エラーコードを調べてエラーを返す
			if ( res.match(/err;([^/s]*?)\r/) ) {
				if (typeof(callback) === 'function') {
					var errorCode   = RegExp.$1
					  , commandName = command.replace(/;.*?$/, '')
					;
					console.log(errorCode, commandName);
					callback(this.errTable[commandName][errorCode], res);
				}
			} else {
				if (typeof(callback) === 'function') {
					callback(null, res);
				}
			}
		}.bind(this));

		// その他のエラー
		socket.on('error', function(err) {
			callback({
				code   : '999',
				error  : '不明なエラー',
				detail : err
			}, '');
			socket.destroy();
		}.bind(this));

		// 終了時
		socket.on('close', function() {
			// socket を空にする
			this.socket_ = null;

			// 接続確立不可エラーを返すタイマーを消去
			if (this.timer_) {
				clearTimeout(this.timer_);
				this.timer_ = null;
			}
		}.bind(this));
	},
	// タイムアウト時間を設定
	setTimeout : function(ms) {
		this.timeout_ = ms;
	},
	// IP を設定する
	setIP : function(ip) {
		this.ip_ = ip;
	},
	// IP を取得する
	getIP : function() {
		return this.ip_;
	},
	// 接続確認
	au : function(callback) {
		this.send('au', callback);
	},
	// 赤外線発信
	is : function(id, callback) {
		this.send('is;' + id, callback);
	},
	// リモコン学習開始
	ic : function(id, callback) {
		this.send('ic;' + id, callback);
	},
	// リモコン学習中止
	cc : function(callback) {
		this.send('cc', callback);
	},
	// タイマーセット
	tm : function(id, fromNowSec, intervalSec, callback) {
		this.send('tm;' + fromNowSec + ';' + intervalSec, callback);
	},
	// タイマー一覧取得
	tl : function(callback) {
		this.send('tl', callback);
	},
	// タイマー解除
	td : function(id, callback) {
		this.send('td;' + id, callback);
	},
	// 現在時刻設定
	ts : function(timestampSec, callback) {
		this.send('ts;' + timestampSec, callback);
	},
	// 現在時刻取得
	tg : function(callback) {
		this.send('tg', callback);
	},
	// ファームのバージョン番号取得
	vr : function(callback) {
		this.send('vr', callback);
	},
	// 照度センサーの値の取得
	li : function(callback) {
		this.send('li', callback);
	},
	// 湿度センサーの値の取得
	hu : function(callback) {
		this.send('hu', callback);
	},
	// 温度センサーの値の取得
	te : function(callback) {
		this.send('te', callback);
	},
	// 照度・湿度・照度センサーの値の取得
	se : function(callback) {
		this.send('se', callback);
	},


	// エラー時の情報
	errTable : {
		'au' : {
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			}
		},
		'is' : {
			'001' : {
				code   : '001',
				error  : 'リモコン番号範囲外',
				detail : '1～1500 の範囲外'
			},
			'002' : {
				code   : '002',
				error  : 'リモコンデータ未登録エラー',
				detail : 'リモコンデータが記録されていない番号が指定された'
			},
			'003' : {
				code   : '003',
				error  : '送信エラー',
				detail : '不正なデータを送信しようとした'
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		},
		'ic' : {
			'001' : {
				code   : '001',
				error  : 'リモコン番号範囲外',
				detail : '1～1500 の範囲外'
			},
			'002' : {
				code   : '002',
				error  : 'キャンセル',
				detail : 'cc コマンドによってキャンセルされた'
			},
			'003' : {
				code   : '003',
				error  : '受信エラー',
				detail : '不正なリモコンデータを受信した'
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		},
		'cc' : {
			'001' : {
				code   : '001',
				error  : '実行エラー',
				detail : 'リモコンコード学習モード以外の状態に対して実行した'
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		},
		'tm' : {
			'001' : {
				code   : '001',
				error  : 'リモコン番号範囲外',
				detail : '1～1500 の範囲外'
			},
			'002' : {
				code   : '002',
				error  : '実行時間範囲外エラー',
				detail : '現在時刻 +1 〜 4102444800 の範囲外'
			},
			'003' : {
				code   : '003',
				error  : '繰り返し時間範囲外エラー',
				detail : '0〜31536000 以外の範囲が指定された'
			},
			'004' : {
				code   : '004',
				error  : '２重登録エラー（同一時間あり）',
				detail : '同一の時間に既にタイマー登録されている'
			},
			'005' : {
				code   : '005',
				error  : '登録数オーバーエラー',
				detail : '登録数オーバー（最大 500 件）'
			},
			'006' : {
				code   : '006',
				error  : 'リモコンデータエラー',
				detail : 'リモコンデータが登録されていない番号が指定された'
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		},
		'tl' : {
			'001' : {
				code   : '001',
				error  : 'タイマー登録なし',
				detail : 'タイマーが１件も登録されていない'
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			}
		},
		'td' : {
			'001' : {
				code   : '001',
				error  : 'タイマー番号範囲外エラー',
				detail : '1 〜 500 の範囲外'
			},
			'002' : {
				code   : '002',
				error  : 'タイマー登録なし',
				detail : '指定したタイマー番号のタイマーが存在しない'
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			}
		},
		'ts' : {
			'001' : {
				code   : '001',
				error  : '設定時間範囲外',
				detail : '1293775200 〜 4102444800 の範囲外'
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			}
		},
		'tg' : {
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			}
		},
		'vr' : {
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			}
		},
		'li' : {
			'001' : {
				code   : '001',
				error  : 'センサーの値が不正',
				detail : ''
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		},
		'hu' : {
			'001' : {
				code   : '001',
				error  : 'センサーの値が不正',
				detail : ''
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		},
		'te' : {
			'001' : {
				code   : '001',
				error  : 'センサーの値が不正',
				detail : ''
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		},
		'se' : {
			'001' : {
				code   : '001',
				error  : 'センサーの値が不正',
				detail : ''
			},
			'010' : {
				code   : '010',
				error  : 'フォーマットエラー',
				detail : 'コマンドの書式が不正'
			},
			'020' : {
				code   : '020',
				error  : 'タイムアウトエラー',
				detail : 'コマンド入力が５秒以上途切れた'
			},
			'051' : {
				code   : '051',
				error  : '内部システムタイムアウトエラー',
				detail : ''
			},
			'052' : {
				code   : '052',
				error  : '内部システム応答データなしエラー',
				detail : ''
			},
			'053' : {
				code   : '053',
				error  : '内部システム応答データ不正エラー',
				detail : ''
			}
		}
	}
};

// モジュール化
module.exports = iRemocon;

