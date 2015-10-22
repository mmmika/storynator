$(function() {
	var scene_tpl = $('#template').html();
	var frame_tpl = $(scene_tpl).find('.frame').wrap('<p>').parent().html();
	var overlay_tpl = $('#overlay-tpl').html();

	var body = $('body'),
		header = $('.header'),
		story = $('.story'),
		dragcase = false,
		changes = false,
		isExport = false,
		linkedFrames = null;

	// activate management and contenteditable
	body.removeClass('nomanagement');
	$('*[contenteditable]').attr('contenteditable', true);



	//*/// import / export

	$('.btn-edit')
		.on('dragstart', function (event) {
			isExport = true;
			event.originalEvent.dataTransfer.setData("text/html", story.html());
			$(this).addClass('export');
		}).on('dragenter', function (event) {
			if(!isExport) $(this).addClass('import');
		}).on('dragleave', function (event) {
			if(!isExport) $(this).removeClass('import');
		}).on('dragend', function(event){
			$(this).removeClass('export');
		}).on('drop', function(event){
			// import
			if(!isExport) {
				var data = event.originalEvent.dataTransfer.getData("text/html");
				$this = $(this);
				$this.toggleClass('loading import');
				story.html(data).promise().done(function(){
					setTimeout(function () {
						$this.removeClass('loading');
						setChanged();
					}, 500);
				});
			}
			isExport = false;
			event.preventDefault();
		});


	//*/// changes

	function setChanged() {
		if(!changes) body.addClass('changed');
		changes = true;
	}
	body.delegate('*[contenteditable]', 'input', function(e){
		setChanged();
	});
	$(window).bind('beforeunload', function(){
		if(changes) return 'Any changes to the storyboard will be lost.';
	});


	//*/// sortable

	Sortable.create(document.querySelector('.scenes'), {
		animation: 200,
		draggable: '.scene',
		handle: '.scene-handle',
		ghostClass: 'dragged',
	});
	var sortableParts = [];
	function initFramesSort() {
		// destroy old ones
		for (var i = 0; i < sortableParts.length; i++) {
			sortableParts[i].destroy();
		}
		sortableParts.length = 0;
		// make new ones
		[].forEach.call(document.querySelectorAll('.frames'), function (el) {
			sortableParts.push(Sortable.create(el, {
				group: 'frames',
				draggable: '.frame',
				handle: '.frame-img',
				chosenClass: 'dragged',
				ghostClass: 'dragged',
				animation: 0,
				onStart: function (evt) {
					dragcase = true;
					tagSiblingsOf($(evt.item));
					delOverlay();
				},
				onEnd: function (evt) {
					dragcase = false;
					manageMoves($(evt.item));
				},
				onSort: function (evt) {
					setChanged();
				}
			}));
		});
	}

	function tagSiblingsOf(item) {
		// tag the frames which are in the same shot
		// that the given item (cf. manageMoves)
		item.nextUntil(':not(.sameshot)')
			.addClass('linked after');
		if(item.hasClass('sameshot')) {
			item.prevUntil(':not(.sameshot)')
				.andSelf().prev()
				.addClass('linked before');
		}
	}
	function manageMoves(item) {
		// manage global behaviors of :
		// - frames moved in their shot,
		// - frames moved in/out a shot,
		// - all a shot moved at once.
		// - shadow frame moved
		// - frame moved after the shadow
		var linked = $('.linked'),
			next = item.next(),
			prev = item.prev(),
			prevIsMyShot = prev.hasClass('linked'),
			nextIsMyShot = next.hasClass('linked'),
			nextHaveSameshot = next.hasClass('sameshot'),
			haveSameshot = item.hasClass('sameshot');

		// moved shadow, or after shadow
		if(item.hasClass('frame-shadow')) unShadow(item);
		if(prev.hasClass('frame-shadow')) unShadow(prev);

		// item was in a shot
		if(linked.length != 0) {
			// moved at the head of its shot
			if(nextIsMyShot && !prevIsMyShot) {
				item.removeClass('sameshot');
				next.addClass('sameshot');
				console.log('moved first of its shot');
			}
			// was the first : others follow the chosen one
			else if(!prevIsMyShot && !haveSameshot) {
				$('.linked.before').detach().insertBefore(item);
				$('.linked.after').detach().insertAfter(item);
				console.log('follow me !');
			}
			// moved outside of its shot
			else if(!prevIsMyShot && !nextIsMyShot) {
				item.removeClass('sameshot');
				console.log('bye bye');
			}
			linked.removeClass('linked before after');
		}
		// is inserted in a shot
		if(nextHaveSameshot) {
			item.addClass('sameshot');
			console.log('moved in a shot');
		}
	}
	initFramesSort();



	//*/// drop image

	story.delegate('.frame', 'dragenter', delOverlay);
	story.delegate('.frame img', 'dragenter', function(e){
		if(!dragcase) {
			e.stopPropagation();
			e.preventDefault();
			$(this).addClass('dragenter');
		}
	});
	story.delegate('.frame img', 'dragleave', function(e){
		if(!dragcase) $(this).removeClass('dragenter');
	});
	story.delegate('.frame img', 'dragover', function(e){
		if(!dragcase) {
			e.stopPropagation();
			e.preventDefault();
		}
	});
	story.delegate('.frame-shadow img', 'drop', function(event){
		loadImage(event, $(this));
		unShadow($(this));
	});
	story.delegate('.frame img', 'drop', function(event){
		loadImage(event, $(this));
	});

	function loadImage (event, img) {
		if(dragcase) return;
		event.preventDefault();

		var file = event.originalEvent.dataTransfer.files[0];
		var frame = img.parents('.frame');
		img.removeClass('dragenter');

		// not a supported image
		var authorized = ['image/jpeg', 'image/gif', 'image/png'];
		if(file === undefined || authorized.indexOf(file.type) == -1) {
			frame.addClass('notimage');
			setTimeout(function () {
				frame.removeClass('notimage');
			}, 200);
			return;
		}

		// let's go
		setChanged();
		var reader = new FileReader();
		reader.readAsDataURL(file);
		reader.addEventListener('loadend', function (e, f) {
			var canvas = document.createElement('canvas');
			var context = canvas.getContext('2d');
			
			var image = new Image();
			image.src = this.result;
			image.onload = function() {
				var width = this.width,
					height = this.height,
					max = 4000;
				// set pano mode
				if(width > 2 * height)
					frame.addClass('ispano');
				// animate
				frame.addClass('dropped');
				setTimeout(function () {
					frame.removeClass('dropped');
				}, 500);
				// limit size
				if(width > max) {
					width = max;
					height = width * (this.height / this.width);
				}
				if(height > max) {
					height = max;
					width = height * (this.width / this.height);
				}
				canvas.width = width;
				canvas.height = height;
				context.scale(width / this.width, height / this.height);
				context.drawImage(this, 0, 0);
				img.attr('src', canvas.toDataURL(file.type, 0.25));
			};
		}, false);
	}

	$(window).on('dragover', function(e){
		e.preventDefault();
	});
	$(window).on('drop', function(event){
		event.preventDefault();
	});



	//*/// add

	story.delegate('.add-scene', 'click', function(e){
		$(scene_tpl).appendTo('.scenes').hide().slideDown(200);
		initFramesSort();
		setChanged();
	});
	story.delegate('.add-frame-before', 'click', function(e){
		var frame = $(frame_tpl).removeClass('frame-shadow management');
		$(this).closest('.scene').find('.frames').prepend(frame);
		setChanged();
	});
	story.delegate('.add-frame', 'click', function(e){
		var scene = $(this).closest('.scene'),
			shadow = scene.find('.frame-shadow');
		if(!shadow.length) shadow = scene.find('.frames').append(frame_tpl);
		unShadow(shadow);
	});
	body.delegate('.frame-shadow *[contenteditable]', 'input', function(e){
		unShadow($(this));
	});
	function unShadow (frame) {
		if(!frame.hasClass('frame')) frame = frame.parents('.frame');
		frame.removeClass('frame-shadow management');
		frame.parent().append(frame_tpl);
		setChanged();
	}



	//*/// case overlay

	function overlay (el){
		var existing = $('.overlay');
		if(existing.length) existing.remove();
		else el.parent().prepend(overlay_tpl);
	}
	function delOverlay(){
		$('.overlay').remove();
	}
	$(window).on('click', function(event) {
		delOverlay();
		var target = $(event.target);
		if(target.is('img') && target.parents('.frame-shadow').length === 0) {
			overlay(target);
		}
	});
	story.delegate('.overlay .delete', 'click', function(e){
		var $case = $(this).closest('.frame');
		$case.addClass('remove');
		setTimeout(function(){
			$case.remove();
		}, 200);
		setChanged();
	});
	story.delegate('.frame *[data-toggle]', 'click', function(e){
		var $this = $(this);
		$this.closest('.frame')
			.toggleClass($this.data('toggle'))
			.find('img')
				.removeAttr('style');
		setChanged();
	});



	//*/// part delete

	story.delegate('.scene-delete', 'click', function(e){
		var part = $(this).closest('.scene');
		part.addClass('hidemanagement')
			.animate({
				opacity: 0, height: 0
			}, function() {
				part.remove();
				setChanged();
			});
	});



	//*/// shortcuts

	function cleanup() {
		var attrs = [
			'data-sortable-id', 'data-item-sortable-id',
			'role', 'aria-grabbed', 'aria-dropeffect',
			'draggable', 'style'];
		$.each(attrs, function(id, val){
			$('*['+val+']').removeAttr(val);
		});
	}
	$(window).on('keydown', function(event) {
		if (event.ctrlKey || event.metaKey) {
			switch (String.fromCharCode(event.which).toLowerCase()) {
			case 'q':
				cleanup();
				alert('cleaned');
			}
		}
	});
});
