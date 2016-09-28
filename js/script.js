var tplhb = {},
	config = {
		maxPlayers: 32
	},
	gldata = null;

$(function() {
	initTpl();
	initEvents();
	if(location.hash) {
		// Load from hash
		var hash = location.hash.substr(1);
		try {
			gldata = JSON.parse(atob(hash));
			save();
			render();
		} catch(error) {
			console.log(error);
			alert('Invalid permalink');
			$('.show-tournament').show();
		}
		history.pushState('', document.title, location.pathname);
	} else {
		// Try to load from localStorage
		var str;
		if(str = localStorage.getItem('gldata')) {
			try {
				gldata = JSON.parse(str);
				save();
				render();
			} catch(error) {
				console.log(error);
				alert('Stored data is invalid');
				$('.show-tournament').show();
			}
		} else {
			$('#edit').show();
		}
	}
});

function initTpl() {
	$('script[type="text/template"]').each(function() {
		var id = $(this).attr('id').replace(/^tpl-/, '');
		if($(this).hasClass('tpl-partial')) {
			Handlebars.registerPartial(id, $(this).html());
		} else {
			tplhb[id] = Handlebars.compile($(this).html());
		}
	});
	
	Handlebars.registerHelper('_getPlayer', function(player, ctx) {
		if(player) {
			var name = player.replace(/^#/, ''),
				won = /^#/.test(player),
				player = _.findWhere(gldata.players, { name: name });
			return {
				avatar: player.avatar,
				name: player.name,
				won: won,
				twitch: ctx.hash.twitch
			};
		}
		return { twitch: ctx.hash.twitch };
	});
	Handlebars.registerHelper('_getAvatar', function(avatar, name) {
		return name ? (avatar ? 'https://static-cdn.jtvnw.net/jtv_user_pictures/' + name.toLowerCase() + '-profile_image-' + avatar.replace(/\./, '-300x300.') : 'https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_300x300.png') : '';
	});
}

function initEvents() {
	$('#nav-new').click(function(e) {
		e.preventDefault();
		gldata = null;
		if(location.hash) {
			history.pushState('', document.title, location.pathname);
		}
		localStorage.removeItem('gldata');
		$('.show-tournament').hide();
		$('#edit').show();
		$('#edit-name').keyup();
	});
	$('#nav-share').click(function(e) {
		e.preventDefault();
		if(gldata) {
			prompt('Share', location.href.split('#')[0] + '#' + btoa(JSON.stringify(gldata)));
		}
	});
	
	$('#form-edit').submit(function(e) {
		e.preventDefault();
		var players = $('#edit-participants').val().replace(/\n$/, '').split('\n'),
			count = players.length,
			playerObjs = new Array(count);
		
		if(count > 1) {
			gldata = {
				name: $('#edit-name').val(),
				// randomize: $('#edit-randomize').prop('checked'),
				thirdplace: $('#edit-thirdplace').prop('checked') && count > 2,
				twitch: $('#edit-twitch').prop('checked')
			};
			
			if(gldata.twitch) {
				_.each(players, function(player, i) {
					getUserInfo(player).then(function(resp) {
						playerObjs[i] = {
							avatar: resp.logo ? resp.logo.replace(/^.+profile_image-(.+)-300x300\.(.+)$/, '$1.$2') : undefined,
							name: resp.display_name
						};
						count--;
						if(count === 0) {
							gldata.players = playerObjs;
							generate();
						}
					});
				});
			} else {
				gldata.players = _.map(players, function(player) {
					return {
						name: player
					};
				});
				generate();
			}
		}
	});
	
	$('#edit-name').keyup(function() {
		$('#title').text($(this).val() || 'TwitchTournament');
	}).keyup();
	$('#edit-participants').keyup(function() {
		var val = $(this).val().split('\n'),
			total = val.length + (_.last(val) === '' ? -1 : 0);
		$('#edit-participants-total').text(total);
		if(total > config.maxPlayers) {
			alert('More than 32 players are not supported :(');
			$(this).val($(this).val().split('\n').slice(0, 32).join('\n')).keyup();
		}
	}).keyup();
	
	$('#tournament').on('click', '.player', function(e) {
		e.stopPropagation();
		var $winner = $(this),
			$loser = $winner.siblings('.player').first(),
			data, round, game, player;
		
		if(!$winner.hasClass('empty')) {
			data = {
				name: $winner.find('.name').text(),
				avatar: $winner.find('.avatar img').attr('src'),
				player: $winner.index() + ($winner.parents('.game').hasClass('thirdplace') ? -1 : 0),
				game: $winner.parents('.game').index(),
				round: $winner.parents('.round').index()
			};
			if(gldata.thirdplace && gldata.players.length > 2 && data.round == gldata.bracket.length - 2) {
				// Add losers for 3rd place match
				_.extend(data, {
					hasLoser: true,
					loserName: $loser.find('.name').text(),
					loserAvatar: $loser.find('.avatar img').attr('src')
				});
			}
			round = data.round + 1;
			game = Math.floor(data.round ? data.game / 2 : data.game);
			player = data.round ? data.game % 2 : 1;
			
			$loser.removeClass('winner').addClass('loser');
			$winner.removeClass('loser').addClass('winner');
			
			_.each(gldata.bracket[data.round][data.game], function(p, i) {
				gldata.bracket[data.round][data.game][i] = p.replace(/^#/, '');
			});
			gldata.bracket[data.round][data.game][data.player] = '#' + gldata.bracket[data.round][data.game][data.player];
			if(round < gldata.bracket.length) {
				// Move to next round
				gldata.bracket[round][game][player] = data.name;
				$('.round').eq(round).find('.game').eq(game).find('.player').eq(player).removeClass('empty')
					.find('.avatar img').attr('src', data.avatar).end()
					.find('.name').text(data.name).end()
					.addClass('in');
				if(data.hasLoser) {
					gldata.bracket[round][1][data.game] = (gldata.players.length == 3 ? '#' : '') + data.loserName;
					$('.round').last().find('.game').last().find('.player').eq(data.game).removeClass('empty')
						.find('.avatar img').attr('src', data.loserAvatar).end()
						.find('.name').text(data.loserName).end()
						.addClass('in' + (gldata.players.length == 3 ? ' winner': ''));
				}
			} else if(data.game === 0) {
				// Tournament winner
				if(gldata.twitch) {
					$('#winner-avatar').attr('src', data.avatar);
					$('.winner-avatar').addClass('has-avatar');
				}
				$('#winner-name').text(data.name);
				$('#winner-screen').show(0, function() {
					$(this).addClass('in');
				});
				$('body').one('click', function() {
					$('#winner-screen').removeClass('in');
					setTimeout(function() {
						$('#winner-screen').hide();
					}, 300);
				});
			}
			
			save();
		}
	});
}

function generate() {
	var bin = 1,
		len = gldata.players.length,
		pot = len,
		rest = 0,
		pLen, prLen,
		players, restPlayers,
		playersObj = {},
		currRound = 0,
		totalRounds,
		shuffledPlayers,
		roundZero, roundOne, //roundZeroSeeded,
		i;
	
	// Find nearest power of two and rest
	while(bin <= config.maxPlayers) {
		if(len == bin) {
			break;
		} else if(len < bin) {
			bin = bin >> 1;
			pot = bin;
			rest = len - bin;
			break;
		} else {
			bin = bin << 1;
		}
	}
	// Create empty bracket
	totalRounds = Math.log2(pot) + 1;
	gldata.bracket = _.times(totalRounds, function(n) {
		return _.times(pot/Math.pow(2, n || 1), function() {
			return ['', ''];
		});
	});
	if(gldata.thirdplace && len > 2) {
		// Add a 3rd place match
		gldata.bracket[totalRounds - 1].push(['', '']);
	}
	// Adjust numbers of players in the first two rounds if rest > 0
	pLen = pot - rest;
	prLen = rest * 2;
	// Divide players
	shuffledPlayers = _.shuffle(gldata.players);
	players = shuffledPlayers.slice(0, pLen).concat(new Array(rest));
	restPlayers = rest ? shuffledPlayers.slice(-prLen) : [];
	
	// Seed players
	roundZero = new Array(pot);
	// roundZeroSeeded = new Array(pot);
	roundOne = new Array(pot);
	if(rest) {
		for(i=0; i<pot; i++) {
			roundZero[i] = (i % 2 ? restPlayers.pop() : restPlayers.shift()) || { name: '' };
		}
	}
	for(i=0; i<pot; i++) {
		roundOne[i] = (i % 2 ? players.pop() : players.shift()) || { name: '' };
	}
	// Put players into bracket
	if(rest) {
		gldata.roundzero = true;
		// Plant seeds
		/*for(i=0; i<prLen/2; i++) {
			if(i % 2) {
				roundZeroSeeded[i * 2] = roundZero.shift();
				roundZeroSeeded[i * 2 + 1] = roundZero.shift();
			} else {
				roundZeroSeeded[i * 2 + 1] = roundZero.pop();
				roundZeroSeeded[i * 2] = roundZero.pop();
			}
		}*/
		// Distribute games
		if(pot > prLen) {
			for(i=0; i<pot/2; i++) {
				if(i % 2) {
					gldata.bracket[currRound][i][1] = roundZero.pop().name;
					gldata.bracket[currRound][i][0] = roundZero.pop().name;
				} else {
					gldata.bracket[currRound][i][0] = roundZero.shift().name;
					gldata.bracket[currRound][i][1] = roundZero.shift().name;
				}
			}
		} else {
			for(i=0; i<pot/2; i++) {
				gldata.bracket[currRound][i][0] = roundZero[i * 2].name;
				gldata.bracket[currRound][i][1] = roundZero[i * 2 + 1].name;
			}
			roundZero = [];
		}
	}
	currRound++;
	for(i=0; i<pot/2; i++) {
		if(i % 2) {
			gldata.bracket[currRound][i][1] = roundOne.pop().name;
			gldata.bracket[currRound][i][0] = roundOne.pop().name;
		} else {
			gldata.bracket[currRound][i][0] = roundOne.shift().name;
			gldata.bracket[currRound][i][1] = roundOne.shift().name;
		}
	}
	
	save();
	render();
}

function getUserInfo(nick) {
	return $.ajax({
		url: 'https://api.twitch.tv/kraken/users/' + nick,
		headers: {
			'Client-ID': '40w88knq1yh4uin839dqjg5lxuhxns9'
		},
		error: function(resp) {
			alert(resp.responseJSON.message);
		}
	});
}

function save() {
	localStorage.setItem('gldata', JSON.stringify(gldata));
}
function render() {
	$('#title').text(gldata.name || 'TwitchTournament');
	$('#edit').hide();
	$('#tournament').html(tplhb.tournament(gldata))
	$('.show-tournament').show();
	
	$('#tournament').find('.game').each(function() {
		if($(this).find('.winner').length) {
			$(this).find('.player').not('.winner').addClass('loser');
		}
	});
}