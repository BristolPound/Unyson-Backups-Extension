/**
 * Check current status
 */
jQuery(function ($) {
	var inst = {
		localized: _fw_ext_backups_demo,
		getEventName: function(name) {
			return 'fw:ext:backups-demo:status:'+ name;
		},
		timeoutId: 0,
		timeoutTime: 3000,
		/**
		 * 0 - (false) not busy
		 * 1 - (true) busy
		 * 2 - (true) busy and a pending ajax
		 */
		isBusy: 0,
		doAjax: function() {
			if (this.isBusy) {
				this.isBusy = 2;
				return false;
			}

			clearTimeout(this.timeoutId);

			fwEvents.trigger(this.getEventName('updating'));

			$.ajax({
					url: ajaxurl,
					type: 'POST',
					dataType: 'json',
					data: {
						action: this.localized.ajax_action.status
					}
				})
				.done(_.bind(function(r){
					if (r.success) {
						fwEvents.trigger(this.getEventName('update'), r.data);
					} else {
						fwEvents.trigger(this.getEventName('update-fail'));
					}
				}, this))
				.fail(_.bind(function(jqXHR, textStatus, errorThrown){
					console.error('Ajax error', jqXHR, textStatus, errorThrown);
					fwEvents.trigger(this.getEventName('update-fail'));
				}, this))
				.always(_.bind(function(data_jqXHR, textStatus, jqXHR_errorThrown){
					fwEvents.trigger(this.getEventName('updated'));

					if (this.isBusy === 2) {
						this.isBusy = 0;
						this.doAjax();
					} else {
						this.isBusy = 0;
					}

					this.timeoutId = setTimeout(_.bind(this.doAjax, this), this.timeoutTime);
				}, this));

			return true;
		},
		onUpdate: function(data) {
			this.timeoutTime = data.is_busy ? 3000 : 10000;
		},
		init: function(){
			this.init = function(){};

			fwEvents.on(this.getEventName('do-update'), _.bind(function(){ this.doAjax(); }, this));
			fwEvents.on(this.getEventName('update'), _.bind(function(data){ this.onUpdate(data); }, this));

			this.doAjax();
		}
	};

	// let other scripts to listen events
	setTimeout(function(){ inst.init(); }, 100);
});

/**
 * Current status
 */
jQuery(function($){
	var inst = {
		failCount: 0,
		fwSoleModalId: 'fw-ext-backups-demo-status',
		onUpdating: function(){},
		onUpdate: function(data) {
			if (data.is_busy) {
				fw.soleModal.show(
					this.fwSoleModalId,
					data.html,
					{
						allowClose: false,
						updateIfCurrent: true,
						backdrop: null
					}
				);
			} else {
				fw.soleModal.hide(this.fwSoleModalId);
			}

			this.failCount = 0;
		},
		onUpdateFail: function() {
			if (this.failCount > 3) {
				fw.soleModal.show(
					this.fwSoleModalId,
					'<span class="fw-text-danger dashicons dashicons-warning"></span>',
					{
						allowClose: false,
						backdrop: null
					}
				);
			}
			++this.failCount;
		},
		onUpdated: function() {},
		init: function(){
			fwEvents.on({
				'fw:ext:backups-demo:status:updating': _.bind(this.onUpdating, this),
				'fw:ext:backups-demo:status:update': _.bind(this.onUpdate, this),
				'fw:ext:backups-demo:status:update-fail': _.bind(this.onUpdateFail, this),
				'fw:ext:backups-demo:status:updated': _.bind(this.onUpdated, this)
			});
		}
	};

	inst.init();
});

/**
 * Install button
 */
jQuery(function($) {
	var inst = {
		localized: _fw_ext_backups_demo,
		isBusy: false,
		fwLoadingId: 'fw-ext-backups-demo-install',
		init: function(){
			fwEvents.on('fw:ext:backups-demo:status:update', function(data){
				{
					$('#fw-ext-backups-demo-list .fw-ext-backups-demo-item').removeClass('active');

					if (data.active_demo.id) {
						$('#demo-'+ data.active_demo.id).addClass('active');
					}
				}

				if (data.active_demo.result) {
					if (data.active_demo.result === true) {
						fw.soleModal.show(
							inst.fwLoadingId,
							'<span class="dashicons dashicons-yes fw-text-success"'
							+' style="font-size: 100px; width: 100px; height: 100px;"></span>',
							{
								allowClose: false,
								backdrop: false
							}
						);

						setTimeout(function () {
							$('#fw-ext-backups-demo-list').fadeOut();

							window.location.assign(data.home_url);
						}, 3000);
					} else {
						fw.soleModal.show(
							inst.fwLoadingId,
							'<h3 class="fw-text-danger">'+ data.active_demo.result +'</h3>',
							{
								backdrop: false
							}
						);
					}
				}
			});

			$('#fw-ext-backups-demo-list').on('click', '[data-install]', function(){
				if (inst.isBusy) {
					console.log('Install is busy');
					return;
				}

				var $this = $(this),
					demoId = $this.attr('data-install'),
					confirm_message = $this.attr('data-confirm');

				if (confirm_message) {
					if (!confirm(confirm_message)) {
						return;
					}
				}

				inst.isBusy = true;
				fw.loading.show(inst.fwLoadingId);

				$.ajax({
					url: ajaxurl,
					data: {
						action: inst.localized.ajax_action.install,
						id: demoId
					},
					type: 'POST',
					dataType: 'json'
				})
					.done(function(r){
						if (r.success) {
							fwEvents.trigger('fw:ext:backups-demo:status:do-update');
						} else {
							fw.soleModal.show(
								'fw-ext-backups-demo-install-error',
								((r.data && r.data.length) ? r.data[0].message : ''),
								{
									backdrop: false
								}
							);
						}
					})
					.fail(function(jqXHR, textStatus, errorThrown){
						fw.soleModal.show(
							'fw-ext-backups-demo-install-error',
							'<h2>Ajax error</h2>'+ '<p>'+ String(errorThrown) +'</p>',
							{
								backdrop: false
							}
						);
					})
					.always(function(data_jqXHR, textStatus, jqXHR_errorThrown){
						inst.isBusy = false;
						fw.loading.hide(inst.fwLoadingId);
					});
			});
		}
	};

	inst.init();
});