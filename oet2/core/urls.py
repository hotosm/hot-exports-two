# -*- coding: utf-8 -*-
"""
HOT Exports URL Configuration
"""
from django.conf.urls import include, patterns, url
from django.conf.urls.i18n import i18n_patterns
from django.contrib import admin
from django.views.generic import TemplateView
from django.views.i18n import javascript_catalog

from oet2.api.urls import router
from oet2.api.views import HDMDataModelView, OSMDataModelView, RunJob
from oet2.ui import urls as ui_urls
from oet2.ui.views import (
    about, create_error_view, help_create, help_exports, help_features,
    help_formats, help_main, help_presets
)

admin.autodiscover()

urlpatterns = []

urlpatterns += i18n_patterns('oet2.ui.views',
    url(r'^$', 'login', name='index'),
    url(r'^exports/', include(ui_urls)),
    url(r'^login/$', 'login', name="login"),
    url(r'^logout$', 'logout', name='logout'),
    url(r'^error$', create_error_view, name='error'),
    url(r'^about$', about, name='about'),
    url(r'^update$', TemplateView.as_view(template_name='oet2/ui/upgrade.html'), name='update'),
    url(r'^email/$', 'require_email', name='require_email'),
)

urlpatterns += i18n_patterns('oet2.ui.help',
    url(r'^help$', help_main, name='help'),
    url(r'^help/create$', help_create, name='help_create'),
    url(r'^help/features$', help_features, name='help_features'),
    url(r'^help/exports$', help_exports, name='help_exports'),
    url(r'^help/formats$', help_formats, name='help_formats'),
    url(r'^help/presets$', help_presets, name='help_presets'),
)

urlpatterns += i18n_patterns('admin.views',
    url(r'^admin/', include(admin.site.urls)),
)

# OAuth urls
urlpatterns += i18n_patterns('oet2.ui.social',
    url('^osm/', include('social.apps.django_app.urls', namespace='osm')),
    url('^osm/email_verify_sent/$', TemplateView.as_view(template_name='osm/email_verify_sent.html'), name='email_verify_sent'),
    url('^osm/error$', TemplateView.as_view(template_name='osm/error.html'), name='login_error')
)

# don't apply i18n patterns here.. api uses Accept-Language header
urlpatterns += patterns('oet2.api.views',
    url(r'^api/', include(router.urls, namespace='api')),
    url(r'^api/', include('rest_framework.urls', namespace='rest_framework')),
    url(r'^api/rerun$', RunJob.as_view(), name='rerun'),
    url(r'^api/hdm-data-model$', HDMDataModelView.as_view(), name='hdm-data-model'),
    url(r'^api/osm-data-model$', OSMDataModelView.as_view(), name='osm-data-model'),
)

# i18n for js
js_info_dict = {
    'packages': ('hot_osm',),
}

urlpatterns += patterns('',
    url(r'^jsi18n/$', javascript_catalog, js_info_dict),
    url(r'^i18n/', include('django.conf.urls.i18n')),
)

# handler500 = 'oet2.ui.views.internal_error_view'

# handler404 = 'oet2.ui.views.not_found_error_view'
