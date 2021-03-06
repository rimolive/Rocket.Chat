const msgStream = new Meteor.Streamer('room-messages');
this.msgStream = msgStream;

msgStream.allowWrite('none');

msgStream.allowRead(function(eventName) {
	try {
		const room = Meteor.call('canAccessRoom', eventName, this.userId);

		if (!room) {
			return false;
		}

		if (room.t === 'c' && !RocketChat.authz.hasPermission(this.userId, 'preview-c-room') && room.usernames.indexOf(room.username) === -1) {
			return false;
		}

		return true;
	} catch (error) {
		/*error*/
		return false;
	}
});

msgStream.allowRead('__my_messages__', 'all');

msgStream.allowEmit('__my_messages__', function(eventName, msg, options) {
	try {
		const room = Meteor.call('canAccessRoom', msg.rid, this.userId);

		if (!room) {
			return false;
		}

		options.roomParticipant = room.usernames.indexOf(room.username) > -1;
		options.roomType = room.t;

		return true;
	} catch (error) {
		/*error*/
		return false;
	}
});

Meteor.startup(function() {
	function publishMessage(type, record) {
		if (record._hidden !== true && (record.imported == null)) {
			msgStream.emitWithoutBroadcast('__my_messages__', record, {});
			return msgStream.emitWithoutBroadcast(record.rid, record);
		}
	}

	return RocketChat.models.Messages._db.on('change', function({action, id, data/*, oplog*/}) {
		switch (action) {
			case 'insert':
				data._id = id;
				publishMessage('inserted', data);
				break;
			case 'update:record':
				publishMessage('updated', data);
				break;
			case 'update:diff':
				publishMessage('updated', RocketChat.models.Messages.findOne({
					_id: id
				}));
				break;
		}
	});
});
