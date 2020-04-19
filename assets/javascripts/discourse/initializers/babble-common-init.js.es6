import { withPluginApi } from 'discourse/lib/plugin-api'
import Babble            from '../lib/babble'
import { on }            from 'discourse-common/utils/decorators'
import { wantsNewWindow } from 'discourse/lib/intercept-click';

export default {
  name: 'babble-common-init',
  initialize() {

    withPluginApi('0.8.9', api => {
      api.modifyClass('controller:preferences/interface', {
        actions: {
          save () {
            this.get('saveAttrNames').push('custom_fields')
            this._super()
          }
        }
      })

      if (Babble.disabled()) { return }

      api.modifyClass("controller:flag", {
        actions: {
          createFlag(opts) {
            if(!this.get('model.can_flag')) { return this._super(opts) }
            this.send('hideModal')
            let postAction = this.get('model.actions_summary').findBy('id', this.get('selected.id'));

            return postAction.act(this.get('model'), opts).then(() => {
              this.set('model.has_flagged', true)
              this.appEvents.trigger('babble-rerender')
            }).finally(() => {
              this.send('closeModal')
            })
          }
        }
      })

      api.modifyClass("component:user-card-contents", {
        @on('didInsertElement')
        listenForBabble() {
          this.appEvents.on("babble-toggle-chat", () => {
            Ember.run.scheduleOnce('afterRender', () => {
              if ($('.babble-sidebar').length) {
                $('.babble-sidebar').on('click.discourse-user-card', '[data-user-card]', (e) => {
                  if (wantsNewWindow(e)) { return }
                  if (this.site.isMobileDevice) { this.appEvents.trigger('babble-toggle-chat') }
                  const $target = $(e.currentTarget)
                  return this._show($target.data('user-card'), $target)
                })
                $('.babble-sidebar').on('click.discourse-user-mention', 'a.mention', (e) => {
                  if (wantsNewWindow(e)) { return }
                  const $target = $(e.target)
                  return this._show($target.text().replace(/^@/, ''), $target)
                })

              } else {
                $('.babble-sidebar').off('click.discourse-user-card')
              }
            })
          })
        }
      })

      api.modifyClass("component:site-header", {
        @on('didInsertElement')
        initialize() {
          if (!this.site.isMobileDevice) { return }

          this.appEvents.on('babble-has-topics', () => {
            api.decorateWidget('header-icons:before', (helper) => {
              return helper.attach('header-dropdown', {
                title:         'babble.title',
                icon:          Discourse.SiteSettings.babble_icon,
                iconId:        'babble-icon',
                action:        'toggleBabble',
                contents() {
                  if (!Babble.unreadCount()) { return }
                  return this.attach('link', {
                    action:    'toggleBabble',
                    className: 'babble-unread babble-unread--header',
                    rawLabel:  Babble.unreadCount()
                  })
                }
              })
            })
          })

          api.attachWidgetAction(this.widget, 'toggleBabble', () => {
            this.appEvents.trigger("babble-toggle-chat")
          })

          this.appEvents.on("babble-rerender", () => {
            this.queueRerender()
          })
        }
      })

      api.modifyClass('component:emoji-picker', {

        @on("didInsertElement")
        _setup() {
          if (!this.attrs.babble) { return }

          this.appEvents.on('babble-emoji-picker:open', this, () => this.set('active', true))
          // this.appEvents.on("babble-emoji-picker:close", this, () => this.set('active', false))
          $('html').on('keydown.babble-emoji-picker', e => {
            if (e.which != 27) { return }
            this.appEvents.trigger('babble-emoji-picker:close')
          })
          $('html').on('click.babble-emoji-picker', e => {
            if ($(e.target).closest('.babble-emoji-picker').length) { return }
            this.appEvents.trigger('babble-emoji-picker:close')
          })
        },

        @on('willDestroyElement')
        _teardown() {
          if (!this.attrs.babble) { return }

          this.appEvents.off('babble-emoji-picker:open')
          this.appEvents.off('babble-emoji-picker:close')
          $('html').off('keydown.babble-emoji-picker')
          $('html').off('click.babble-emoji-picker')
        }
      })
    })
  }
}
